import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Typography, Box, Stack, Button, TextField, LinearProgress } from "@mui/material";
import { UI_DECIMALS, RK_BADGE, RK_CODE_API, USER_ID } from "../api/NPconfig";
import { NP_measure, NP_setRefWeight } from "../api/NPnp";
import { NP_printLabelViaAgent } from "../api/NPagent";
import NPuseWeightStream from "../hooks/NPuseWeightStream";
import { NP_computeOrderedBoxes } from "../utils/NPorders";

export default function NPScanWeighModal({
  open, onClose,
  line, palletId, ean, linesOnPallet,
  successAudio, errorAudio, onSaved,
  onLineUpdated, onRefUpdated,
  slotName,
}) {
  const [phase, setPhase]   = useState("ready"); // saving|error|ready
  const [msg, setMsg]       = useState("Připraveno. Polož balík a stiskni VÁŽIT, nebo TEST TISK ŠTÍTKU.");
  const [tolAbs, setTolAbs] = useState(0.20);
  const [minPlacedKg, setMinPlacedKg] = useState(0.20);

  const { live } = NPuseWeightStream(open);

  const [nextPos, setNextPos] = useState(1);       // auto-pozice pro uložení (kvůli kolizím)
  const displayPosRef = useRef(1);                 // STÁLÁ pozice pro TISK = poslední sloupec FE (idx+1)

  const [confirmOpen, setConfirmOpen] = useState(false);
  const measuredRef = useRef(null);

  // init při otevření
  useEffect(() => {
    if (!open) return;
    setPhase("ready");
    setMsg("Připraveno. Polož balík a stiskni VÁŽIT, nebo TEST TISK ŠTÍTKU.");

    const idx = (linesOnPallet || []).findIndex((l) => l.id === line?.id);
    const tablePos = idx >= 0 ? Math.max(1, Math.min(20, idx + 1)) : 1;
    displayPosRef.current = tablePos;
    setNextPos(tablePos);
  }, [open, ean, line?.id]);

  /* ================== HELPER: uložit s pozicí (auto-retry) =========== */
  async function saveWithAutoPosition(measured) {
    // pořadí, které zkusíme do DB (kvůli kolizím); TISK to neovlivní
    const order = [];
    for (let p = nextPos; p <= 20; p++) order.push(p);
    for (let p = 1; p < nextPos; p++)  order.push(p);

    for (const pos of order) {
      try {
        const resp = await NP_measure({
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
    const rkResp = await NP_measure({
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
      await NP_printLabelViaAgent({
        out,
        measured,
        displayPosition: displayPosRef.current,
        forRK: false,
        line,
        slotName,
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
      const resp = await NP_measure({
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

      await NP_printLabelViaAgent({
        out,
        measured,
        displayPosition: 0,
        forRK: true,
        line,
        slotName,
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
      const r = await NP_setRefWeight(Number(line.id), measured);
      if (r?.data?.line) onLineUpdated?.(r.data.line);
      else onRefUpdated?.(line.id, measured);
    } catch (e) {
      console.warn("set-ref-weight:", e?.response?.data || e);
    }

    // pokračuj uložením bez tolerance
    await proceedSave(measured, { force: true });
  };

  const canWeigh = isFinite(live?.measurement) && (live?.measurement ?? 0) >= (minPlacedKg || 0.2);

  const scannedBoxes  = Number(line?.scanned_boxes || 0);
  const orderedBoxes  = Number.isFinite(Number(line?.ordered_boxes)) ? Number(line.ordered_boxes) : NP_computeOrderedBoxes(line);

  const positionDisplay = String(displayPosRef.current);
  const positionColor = useMemo(() => {
    const n = Number(displayPosRef.current || 1);
    const hue = ((isFinite(n) ? n : 1) * 47) % 360;
    return `hsl(${hue} 70% 45%)`;
  }, [open, line?.id]);

  return (
    <>
      <Dialog open={open} onClose={() => (phase === "saving" ? null : onClose?.())} fullWidth maxWidth="sm">
        <DialogTitle>Vážení po skenu</DialogTitle>
        <DialogContent>
          {!line ? (
            <Typography>Neplatný produkt.</Typography>
          ) : (
            <Stack direction="row" spacing={2} alignItems="stretch" sx={{ minHeight: 360 }}>
              {/* levý barevný blok se STÁLOU FE pozicí */}
              <Box sx={{ minWidth: 140, maxWidth: 160, flexShrink: 0, background: positionColor, color: "#fff", display:"flex", alignItems:"center", justifyContent:"center", borderRadius: 1 }}>
                <Typography sx={{ fontSize: "6rem", lineHeight: 1, fontWeight: 800 }}>{positionDisplay}</Typography>
              </Box>

              {/* pravý panel */}
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ mb: 0.5 }}>{line.tk_nazev || line.popis}</Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Číslo položky: {line.item_number} {slotName ? ` • Slot: ${slotName}` : ""}
                </Typography>

                <Typography sx={{ mt: 1 }}>EAN: {ean}</Typography>
                <Typography sx={{ mt: 0.5, fontWeight: 600 }}>Naskenováno: {scannedBoxes} / {orderedBoxes} kr</Typography>
                <Typography sx={{ mt: 0.5 }}>Referenční váha: {Number(line.gross_weight_ctn_kg || 0)} kg</Typography>

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
                  <Button variant="contained" size="large" onClick={weighNow} disabled={!canWeigh || phase === "saving"}>VÁŽIT</Button>

                  <Button
                    variant="outlined"
                    size="large"
                    onClick={async ()=> {
                      try {
                        setPhase("saving");
                        setMsg("Posílám testovací štítek na tisk…");
                        const measured = Number((isFinite(live?.measurement) ? live.measurement : (line?.gross_weight_ctn_kg ?? 0.123)).toFixed(3));
                        const out = { carton_code: `TEST-${Date.now().toString().slice(-6)}`, measurement_id: 0, batch: null };
                        await NP_printLabelViaAgent({ out, measured, displayPosition: displayPosRef.current, forRK: false, line, slotName });
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

                  <TextField label="Tolerance (kg)" type="number" inputProps={{ step: "0.01", min: "0" }} value={tolAbs} onChange={(e)=>setTolAbs(Number(e.target.value))} sx={{ width: 160 }} />
                  <TextField label="Min. nárůst pro položení (kg)" type="number" inputProps={{ step: "0.01", min: "0" }} value={minPlacedKg} onChange={(e)=>setMinPlacedKg(Number(e.target.value))} sx={{ width: 220 }} />
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
          <Button onClick={handleConfirmRK} variant="contained" color="error">Předat na ruční kontrolu ({RK_BADGE})</Button>
          <Button onClick={async ()=>{ await handleSetAsRef(); }} variant="outlined" color="primary">Nastavit jako referenční váhu</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}