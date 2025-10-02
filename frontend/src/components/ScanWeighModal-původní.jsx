// src/components/ScanWeighModal.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Typography, Box, Stack, Button, TextField, LinearProgress
} from "@mui/material";
import axios from "axios";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import QRCode from "qrcode";

const AGENT_BASE = process.env.REACT_APP_AGENT_URL || "http://127.0.0.1:4321";
const API_BASE   = process.env.REACT_APP_API_URL   || "";
const USER_ID    = 1;

const LABEL_PRINTER = process.env.REACT_APP_LABEL_PRINTER || "Citizen CL-S521";
const PRINT_TOKEN   = process.env.REACT_APP_PRINT_TOKEN   || null;

// volitelný flip, pokud driver stále otáčí (1 = swap W/H)
const FLIP = String(process.env.REACT_APP_LABEL_FLIP || "0") === "1";

const UI_DECIMALS = 3;
const RK_CODE_API = 0;
const RK_BADGE    = "RK";

// fallback výpočet objednaných krabic
const computeOrderedBoxes = (line) => {
  const pcs = Number(line?.objednano || 0);
  const per = Number(line?.tk_ks_v_krabici || line?.pcs_per_carton || 0);
  if (!isFinite(pcs) || !isFinite(per) || per <= 0) return 0;
  return Math.ceil(pcs / per);
};

/* ===================================================================== */
/* Agent helpers                                                          */
/* ===================================================================== */
async function postAgent(path, body) {
  const headers = { "Content-Type": "application/json" };
  if (PRINT_TOKEN) headers["x-print-token"] = PRINT_TOKEN;
  const r = await fetch(`${AGENT_BASE}${path}`, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
}

/* ===================================================================== */
/* Fonts & text helpers                                                   */
/* ===================================================================== */
function stripDiacritics(s) {
  if (!s) return s;
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
async function tryLoadFontBytes(urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const ab = await res.arrayBuffer();
        return new Uint8Array(ab);
      }
    } catch {}
  }
  return null;
}

/* ===================================================================== */
/* Label PDF (50×100 mm PORTRAIT, třetiny: QR ↑ / texty ↑ / velká pozice)*/
/* ===================================================================== */
const MM = 2.83465;

async function buildLabelPdfBase64({
  carton_code, measurement_id, weight,
  position_to_show, // stálá tisková pozice z FE
  pallet_slot_id, item_code, batch_text, slot_name
}) {
  // Papír: 50 (š) × 100 (v) mm — PORTRAIT
  const WIDTH_MM = 50, HEIGHT_MM = 100;
  const W = (FLIP ? HEIGHT_MM : WIDTH_MM) * MM;
  const H = (FLIP ? WIDTH_MM  : HEIGHT_MM) * MM;

  // Bezpečné okraje (zabrání ořezu QR nahoře)
  const M_TOP_MM = 3;
  const M_BOTTOM_MM = 2;
  const M_SIDE_MM = 2;
  const M_TOP = M_TOP_MM * MM, M_BOTTOM = M_BOTTOM_MM * MM, M_SIDE = M_SIDE_MM * MM;

  const CONTENT_H = H - M_TOP - M_BOTTOM;
  const THIRD = CONTENT_H / 3;

  // Horní třetina (pro QR)
  const TOP_Y0 = H - M_TOP - THIRD;
  const TOP_Y1 = H - M_TOP;

  // Prostřední třetina (pro texty)
  const MID_Y0 = H - M_TOP - 2 * THIRD;
  const MID_Y1 = H - M_TOP - THIRD;

  // Spodní třetina (velká pozice/RK)
  const BOT_Y0 = H - M_TOP - 3 * THIRD; // = M_BOTTOM
  const BOT_Y1 = H - M_TOP - 2 * THIRD;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([W, H]);
  page.setRotation(degrees(0));

  // Fonty
  let fR, fB, unicode = false;
  try {
    const { default: fontkit } = await import("@pdf-lib/fontkit");
    pdf.registerFontkit(fontkit);
    const tryLoad = async (urls)=> {
      for (const url of urls) {
        try {
          const r = await fetch(url);
          if (r.ok) return new Uint8Array(await r.arrayBuffer());
        } catch {}
      }
      return null;
    };
    const regBytes  = await tryLoad([
      "/fonts/LiberationSans-Regular.ttf",
      "/fonts/OpenSans-Regular.ttf",
      "/fonts/NotoSans-Regular.ttf",
      "/fonts/DejaVuSans.ttf",
    ]);
    const boldBytes = await tryLoad([
      "/fonts/LiberationSans-Bold.ttf",
      "/fonts/NotoSans-Bold.ttf",
      "/fonts/DejaVuSans-Bold.ttf",
    ]);
    if (regBytes && boldBytes) {
      fR = await pdf.embedFont(regBytes, { subset: true });
      fB = await pdf.embedFont(boldBytes, { subset: true });
      unicode = true;
    }
  } catch {}
  if (!unicode) {
    fR = await pdf.embedFont(StandardFonts.Helvetica);
    fB = await pdf.embedFont(StandardFonts.HelveticaBold);
  }
  const T = (s)=> unicode ? String(s ?? "") : String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  /* ========== 1) HORNÍ TŘETINA: QR (bez ořezu) ========== */
  const qrPayload = {
    carton_code: carton_code ?? null,
    measured_weight: Number(weight ?? 0),
    prep_position: Number(position_to_show ?? 0),
    prep_positioun: Number(position_to_show ?? 0), // kompatibilita s překlepem
  };
  const qrDataUrl = await QRCode.toDataURL(JSON.stringify(qrPayload), { margin: 0, scale: 8 });
  const qrImg = await pdf.embedPng(qrDataUrl);

  // QR bude mít rezervu od krajů i shora
  const topWidth = W - 2 * M_SIDE;
  const topHeight = THIRD;
  const qrSize = Math.min(topHeight * 0.82, topWidth * 0.82); // mírně menší, aby měl „vzduch“
  const qrX = M_SIDE + (topWidth - qrSize) / 2;
  const qrY = TOP_Y0 + (topHeight - qrSize) / 2;
  page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  // oddělovače třetin (jemné)
  page.drawRectangle({ x:M_SIDE, y: MID_Y1 - 1, width: W - 2*M_SIDE, height: 1.5, color: rgb(0,0,0) });
  page.drawRectangle({ x:M_SIDE, y: TOP_Y1 - 1, width: W - 2*M_SIDE, height: 1.5, color: rgb(0,0,0) });

  /* ========== 2) PROSTŘEDNÍ TŘETINA: hodnoty BEZ popisků ========== */
  const padX = M_SIDE + 2 * MM;
  const lineH = 6 * MM;

  let y = MID_Y1 - 2 * MM; // start kousek pod horní čarou prostřední třetiny

  // 2.1 carton_code (jen hodnota)
  if (carton_code) {
    y -= lineH;
    page.drawText(T(carton_code), {
      x: padX, y, size: 10, font: fB, color: rgb(0,0,0), maxWidth: W - padX - M_SIDE
    });
  }

  // 2.2 measured weight (jen číslo + "kg")
  if (Number.isFinite(Number(weight))) {
    y -= lineH;
    page.drawText(`${Number(weight).toFixed(3)} kg`, {
      x: padX, y, size: 12, font: fB, color: rgb(0,0,0), maxWidth: W - padX - M_SIDE
    });
  }

  // 2.3 Slot (volitelně, malým písmem)
  if (slot_name) {
    y -= lineH - 2; // o chlup menší mezera
    page.drawText(`Slot: ${T(slot_name)}`, {
      x: padX, y, size: 8, font: fR, color: rgb(0,0,0), maxWidth: W - padX - M_SIDE
    });
  }

  /* ========== 3) SPODNÍ TŘETINA: velká pozice/RK ========== */
  const isRK = Number(position_to_show) === 0;
  const posText = isRK ? "RK" : String(position_to_show);
  const posSize = 50;
  const tw = fB.widthOfTextAtSize(T(posText), posSize);
  const th = fB.heightAtSize(posSize);
  const posX = (W - tw) / 2;
  const posY = BOT_Y0 + (THIRD - th) / 2;
  page.drawText(T(posText), { x: posX, y: posY, size: posSize, font: fB, color: rgb(0,0,0) });

  return await pdf.saveAsBase64({ dataUri: false });
}

/* ===================================================================== */
/* Komponenta                                                             */
/* ===================================================================== */
export default function ScanWeighModal({
  open, onClose,
  line, palletId, ean, linesOnPallet,
  successAudio, errorAudio, onSaved,
  onLineUpdated, onRefUpdated,
  slotName,
}) {
  const [phase, setPhase]   = useState("ready"); // saving|error|ready
  const [msg, setMsg]       = useState("Připraveno. Polož balík a stiskni VÁŽIT, nebo TEST TISK ŠTÍTKU.");
  const [live, setLive]     = useState({ measurement: null, stable: false });
  const [tolAbs, setTolAbs] = useState(0.20);
  const [minPlacedKg, setMinPlacedKg] = useState(0.20);

  const [nextPos, setNextPos] = useState(1);       // auto-pozice pro uložení (kvůli kolizím)
  const displayPosRef = useRef(1);                 // STÁLÁ pozice pro TISK = poslední sloupec FE (idx+1)

  const [confirmOpen, setConfirmOpen] = useState(false);
  const measuredRef = useRef(null);

  const esRef        = useRef(null);
  const pollTimerRef = useRef(null);
  const lastValRef   = useRef(null);

  useEffect(() => {
    if (!open) return;
    setPhase("ready");
    setMsg("Připraveno. Polož balík a stiskni VÁŽIT, nebo TEST TISK ŠTÍTKU.");
    lastValRef.current = null;

    // Pořadí řádku v paletě = poslední sloupec FE -> uložíme jako STÁLOU tiskovou hodnotu
    const idx = (linesOnPallet || []).findIndex((l) => l.id === line?.id);
    const tablePos = idx >= 0 ? Math.max(1, Math.min(20, idx + 1)) : 1;
    displayPosRef.current = tablePos;

    // auto "další" pro uložení (kvůli kolizím) necháváme separátně
    setNextPos(tablePos);
  }, [open, ean, line?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // živá váha
  const stableLike = (val) => {
    const prev = lastValRef.current;
    lastValRef.current = val;
    if (prev == null) return false;
    return Math.abs(val - prev) <= 0.01;
  };
  const handleIncoming = (raw) => {
    let val = Number(raw?.measurement ?? NaN);
    if (!isFinite(val)) return;
    const unit = (raw?.unit || "kg").toLowerCase();
    if (unit === "g") val /= 1000;
    const vendorStable = !!raw?.stable;
    const uiStable     = vendorStable || stableLike(val);
    setLive({ measurement: val, stable: uiStable });
  };
  function startPolling() {
    if (pollTimerRef.current) return;
    const url = `${AGENT_BASE}/weight`;
    pollTimerRef.current = setInterval(async () => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const data = await r.json();
        handleIncoming(data);
      } catch {}
    }, 150);
  }
  function stopPolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }
  useEffect(() => {
    if (!open || !line) return;
    const url = `${AGENT_BASE}/stream`;
    let es;
    try {
      es = new EventSource(url);
      esRef.current = es;
      es.onerror = () => { try { es.close(); } catch {}; esRef.current = null; startPolling(); };
      es.onmessage = (e) => { try { handleIncoming(JSON.parse(e.data)); } catch {} };
    } catch {
      startPolling();
    }
    return () => {
      try { esRef.current?.close?.(); } catch {}
      esRef.current = null;
      stopPolling();
      setConfirmOpen(false);
    };
  }, [open, line]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ======================= TISK PŘES AGENTA ========================== */
  async function printLabelViaAgent({ out, measured, displayPosition, forRK }) {
    const position_to_show = forRK ? RK_CODE_API : Number(displayPosition || 0);

    const pdfBase64 = await buildLabelPdfBase64({
      carton_code   : out?.carton_code || out?.cartonCode || null,
      measurement_id: out?.measurement_id ?? null,
      weight        : measured,
      position_to_show,
      pallet_slot_id: forRK ? null : (line?.pallet_slot_id ?? null),
      item_code     : line?.item_number || null,
      batch_text    : out?.batch || null,
      slot_name     : slotName || null,
    });

    await postAgent("/print-pdf", {
      pdfBase64,
      printer: LABEL_PRINTER,
      options: {
        orientation: "portrait",
        paper: { widthMm: 50, heightMm: 100 }, // 5×10 cm
        scale: "noscale",
        silent: true
      }
    });
  }

  /* ================== HELPER: uložit s pozicí (auto-retry) =========== */
  async function saveWithAutoPosition(measured) {
    // pořadí, které zkusíme do DB (kvůli kolizím); TISK to neovlivní
    const order = [];
    for (let p = nextPos; p <= 20; p++) order.push(p);
    for (let p = 1; p < nextPos; p++)  order.push(p);

    for (const pos of order) {
      try {
        const resp = await axios.post(`${API_BASE}/np/measure`, {
          line_id        : Number(line.id),
          pallet_slot_id : line.pallet_slot_id ?? null,
          measured_weight: Number(measured),
          prep_position  : pos,
          user_id        : Number(USER_ID),
          pallet_id      : palletId ?? null,
          ean            : ean ?? null,
        });
        setNextPos(pos === 20 ? 1 : pos + 1);
        if (resp?.data?.line) onLineUpdated?.(resp.data.line);
        return { ok: true, out: resp?.data?.result || null, usedPos: pos };
      } catch (e) {
        const is409 = e?.response?.status === 409 || /Kolize pozice/.test(e?.response?.data?.error || "");
        if (is409) continue;
        throw e;
      }
    }
    // vše obsazené -> RK do DB
    const rkResp = await axios.post(`${API_BASE}/np/measure`, {
      line_id        : Number(line.id),
      pallet_slot_id : null,
      measured_weight: Number(measured),
      prep_position  : Number(RK_CODE_API),
      user_id        : Number(USER_ID),
      pallet_id      : palletId ?? null,
      ean            : ean ?? null,
    });
    if (rkResp?.data?.line) onLineUpdated?.(rkResp.data.line);
    return { ok: true, out: rkResp?.data?.result || null, usedPos: RK_CODE_API };
  }

  /* ============================ AKCE ================================= */
  const weighNow = () => {
    const m = live?.measurement;
    if (!isFinite(m)) return;
    proceedSave(Number(m.toFixed(3)));
  };

  const proceedSave = async (measured, opts = {}) => {
    const force = !!opts.force;
    const refKg = Number(line?.gross_weight_ctn_kg || 0);
    const tol   = Number(tolAbs || 0.2);
    const ok    = force ? true : (isFinite(refKg) && refKg > 0 ? Math.abs(measured - refKg) <= tol : true);

    if (!ok) {
      measuredRef.current = measured;
      setMsg(`MIMO TOLERANCI: ${measured.toFixed(UI_DECIMALS)} kg (ref ${refKg} ± ${tol.toFixed(2)} kg)`);
      try { errorAudio?.current?.play?.(); } catch {}
      setConfirmOpen(true);
      return;
    }

    setPhase("saving");
    setMsg("Ukládám a tisknu…");

    try {
      const { out, usedPos } = await saveWithAutoPosition(measured);

      // ✅ TISK vždy se STÁLOU FE pozicí (poslední sloupec), ne s usedPos
      await printLabelViaAgent({
        out,
        measured,
        displayPosition: displayPosRef.current,
        forRK: false,
      });

      onSaved?.(line.id, measured, usedPos !== RK_CODE_API);
      try { (usedPos === RK_CODE_API ? errorAudio : successAudio)?.current?.play?.(); } catch {}
      onClose?.();
    } catch (e) {
      setPhase("error");
      setMsg(`Chyba ukládání/tisku: ${e?.response?.data?.error || e?.message || e}`);
      try { errorAudio?.current?.play?.(); } catch {}
    }
  };

  // potvrzení RK po odchylce
  const handleConfirmRK = async () => {
    const measured = Number((measuredRef.current ?? live?.measurement ?? 0).toFixed(3));
    setConfirmOpen(false);
    setPhase("saving");
    setMsg("Předávám na RK a tisknu…");

    try {
      const resp = await axios.post(`${API_BASE}/np/measure`, {
        line_id        : Number(line.id),
        pallet_slot_id : null,
        measured_weight: Number(measured),
        prep_position  : Number(RK_CODE_API),
        user_id        : Number(USER_ID),
        pallet_id      : palletId ?? null,
        ean            : ean ?? null,
      });
      const out = resp?.data?.result || null;
      if (resp?.data?.line) onLineUpdated?.(resp.data.line);

      // RK štítek = zobraz „RK“ (position_to_show = 0)
      await printLabelViaAgent({
        out,
        measured,
        displayPosition: 0,
        forRK: true,
      });

      onSaved?.(line.id, measured, false);
      try { errorAudio?.current?.play?.(); } catch {}
      onClose?.();
    } catch (e) {
      setPhase("error");
      setMsg(`Chyba ukládání (RK): ${e?.response?.data?.error || e?.message || e}`);
      try { errorAudio?.current?.play?.(); } catch {}
    }
  };

  const handleSetAsRef = async () => {
    const measured = Number((measuredRef.current ?? live?.measurement ?? 0).toFixed(3));
    setConfirmOpen(false);
    setPhase("saving");
    setMsg("Nastavuji referenční váhu…");

    try {
      const r = await axios.post(`${API_BASE}/np/set-ref-weight`, {
        line_id: Number(line.id),
        new_gross_weight_ctn_kg: measured,
      });
      if (r?.data?.line) onLineUpdated?.(r.data.line);
      else onRefUpdated?.(line.id, measured);
    } catch (e) {
      console.warn("set-ref-weight:", e?.response?.data || e);
    }

    // pokračuj uložením bez tolerance
    await proceedSave(measured, { force: true });
  };

  const handleConfirmCancel = async () => {
    setConfirmOpen(false);
    setPhase("ready");
    setMsg("Stornováno. Můžeš pokračovat.");
  };

  // UI
  const scannedBoxes  = Number(line?.scanned_boxes || 0);
  const orderedBoxes  = Number.isFinite(Number(line?.ordered_boxes)) ? Number(line.ordered_boxes) : computeOrderedBoxes(line);

  const positionDisplay = String(displayPosRef.current); // v UI pořád ukazuj tu stálou FE pozici
  const positionColor = useMemo(() => {
    const n = Number(displayPosRef.current || 1);
    const hue = ((isFinite(n) ? n : 1) * 47) % 360;
    return `hsl(${hue} 70% 45%)`;
  }, [open, line?.id]);

  const canWeigh = isFinite(live?.measurement) && (live?.measurement ?? 0) >= (minPlacedKg || 0.2);

  return (
    <>
      <Dialog
        open={open}
        onClose={() => (phase === "saving" ? null : onClose?.())}
        fullWidth maxWidth="sm"
      >
        <DialogTitle>Vážení po skenu</DialogTitle>
        <DialogContent>
          {!line ? (
            <Typography>Neplatný produkt.</Typography>
          ) : (
            <Stack direction="row" spacing={2} alignItems="stretch" sx={{ minHeight: 360 }}>
              {/* levý barevný čtverec se STÁLOU FE pozicí */}
              <Box sx={{
                minWidth: 140, maxWidth: 160, flexShrink: 0,
                background: positionColor, color: "#fff",
                display:"flex", alignItems:"center", justifyContent:"center", borderRadius: 1,
              }}>
                <Typography sx={{ fontSize: "6rem", lineHeight: 1, fontWeight: 800 }}>
                  {positionDisplay}
                </Typography>
              </Box>

              {/* pravý panel */}
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ mb: 0.5 }}>
                  {line.tk_nazev || line.popis}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Číslo položky: {line.item_number} {slotName ? ` • Slot: ${slotName}` : ""}
                </Typography>

                <Typography sx={{ mt: 1 }}>EAN: {ean}</Typography>

                <Typography sx={{ mt: 0.5, fontWeight: 600 }}>
                  Naskenováno: {scannedBoxes} / {orderedBoxes} kr
                </Typography>

                <Typography sx={{ mt: 0.5 }}>
                  Referenční váha: {Number(line.gross_weight_ctn_kg || 0)} kg
                </Typography>

                <Box mt={2} p={2} sx={{ border: "1px dashed #bbb", borderRadius: 1 }}>
                  <Typography variant="subtitle2">Živá váha</Typography>
                  <Typography sx={{ fontSize: "2rem", fontWeight: 700 }}>
                    {live?.measurement != null ? live.measurement.toFixed(UI_DECIMALS) : "—"} kg
                  </Typography>
                  <Typography variant="caption" color={live?.stable ? "success.main" : "text.secondary"}>
                    {live?.stable ? "stabilní" : "—"}
                  </Typography>
                  {phase === "saving" && <LinearProgress sx={{ mt: 1 }}/>}
                  <Typography sx={{ mt: 1 }}>{msg}</Typography>
                </Box>

                <Stack direction={{ xs:"column", sm:"row" }} spacing={2} sx={{ mt: 2 }} alignItems="center">
                  <Button
                    variant="contained"
                    size="large"
                    onClick={weighNow}
                    disabled={!canWeigh || phase === "saving"}
                  >
                    VÁŽIT
                  </Button>

                  <Button
                    variant="outlined"
                    size="large"
                    onClick={async ()=> {
                      try {
                        setPhase("saving");
                        setMsg("Posílám testovací štítek na tisk…");
                        const measured = Number(
                          (isFinite(live?.measurement) ? live.measurement : (line?.gross_weight_ctn_kg ?? 0.123)).toFixed(3)
                        );
                        const out = {
                          carton_code: `TEST-${Date.now().toString().slice(-6)}`,
                          measurement_id: 0,
                          batch: null
                        };
                        await printLabelViaAgent({
                          out,
                          measured,
                          displayPosition: displayPosRef.current,
                          forRK: false
                        });
                        try { successAudio?.current?.play?.(); } catch {}
                        onClose?.();
                      } catch (e) {
                        setPhase("error");
                        setMsg(`Chyba tisku (test): ${e?.message || e}`);
                        try { errorAudio?.current?.play?.(); } catch {}
                      }
                    }}
                    disabled={phase === "saving"}
                  >
                    TEST TISK ŠTÍTKU
                  </Button>

                  <TextField
                    label="Tolerance (kg)"
                    type="number"
                    inputProps={{ step: "0.01", min: "0" }}
                    value={tolAbs}
                    onChange={(e)=>setTolAbs(Number(e.target.value))}
                    sx={{ width: 160 }}
                  />
                  <TextField
                    label="Min. nárůst pro položení (kg)"
                    type="number"
                    inputProps={{ step: "0.01", min: "0" }}
                    value={minPlacedKg}
                    onChange={(e)=>setMinPlacedKg(Number(e.target.value))}
                    sx={{ width: 220 }}
                  />
                </Stack>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ pb: 2 }}>
          <Button onClick={() => onClose?.()} color={phase === "error" ? "error" : "inherit"} disabled={phase === "saving"}>
            {phase === "error" ? "Zavřít" : "Zrušit"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Nesrovnalost ve váze */}
      <Dialog open={confirmOpen} onClose={() => {}} fullWidth maxWidth="xs">
        <DialogTitle>Nesrovnalost ve váze</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>Zjištěna odchylka proti referenci.</Typography>
          <Typography>Změřená váha: <b>{measuredRef.current != null ? measuredRef.current.toFixed(UI_DECIMALS) : "—"} kg</b></Typography>
          <Typography>Referenční váha: <b>{Number(line?.gross_weight_ctn_kg || 0)} kg</b> ± <b>{Number(tolAbs || 0.2).toFixed(2)} kg</b></Typography>
          <Typography sx={{ mt: 2 }}>
            Chceš <b>stornovat</b>, <b>předat na ruční kontrolu</b> ({RK_BADGE}), nebo <b>nastavit tuto váhu jako referenční</b>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ pb: 2, gap: 1, flexWrap: "wrap" }}>
          <Button onClick={()=>{ setConfirmOpen(false); setPhase("ready"); setMsg("Stornováno. Můžeš pokračovat."); }}>Storno (neukládat)</Button>
          <Button onClick={handleConfirmRK} variant="contained" color="error">
            Předat na ruční kontrolu ({RK_BADGE})
          </Button>
          <Button onClick={handleSetAsRef} variant="outlined" color="primary">
            Nastavit jako referenční váhu
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
