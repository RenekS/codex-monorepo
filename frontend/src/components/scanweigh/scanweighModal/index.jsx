
import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Typography, Box, Stack, Button, Chip } from "@mui/material";

import { DEFAULT_TOL_KG, DEFAULT_MIN_PLACED_KG, UI_DECIMALS, RK_CODE_API } from "../constants";
import useScaleStream from "../useScaleStream";
import LeftBadge from "../LeftBadge";
import LiveControls from "../LiveControls";
import ConfirmDialog from "../ConfirmDialog";
import { buildLabelPdfBase64 } from "../LabelPdf";
import { printPdfBase64ToLabel } from "../../../services/printAgent";
import { saveMeasure, setRefWeight } from "../../../services/npMeasure";
import { computeOrderedBoxes } from "../../../utils/np";

const STABLE_HOLD_MS = Number(process.env.REACT_APP_STABLE_HOLD_MS || 1500);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export default function ScanWeighModal({
  open, onClose,
  line, palletId, ean, linesOnPallet,
  successAudio, errorAudio, onSaved,
  onLineUpdated, onRefUpdated,
  slotName,
  startArmed = false,
  presetCount = 0,
  currentSelNo,
  scanSelNo,
  remainingAtScan = null,
}) {
  const [phase, setPhase] = useState("ready");
  const [msg,   setMsg]   = useState("Připraveno. Polož balík a stiskni VÁŽIT, nebo TEST TISK ŠTÍTKU.");
  const [tolAbs, setTolAbs] = useState(DEFAULT_TOL_KG);
  const [minPlacedKg, setMinPlacedKg] = useState(DEFAULT_MIN_PLACED_KG);

  const measuredRef = useRef(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const displayPosRef = useRef(1);

  const { live } = useScaleStream(open);
  const liveRef = useRef(live);
  useEffect(()=>{ liveRef.current = live; }, [live]);

  const autoTriggeredRef = useRef(false);
  const stableSinceRef = useRef(null);

  const [altArmed, setAltArmed] = useState(false);

  useEffect(() => {
    if (!open || !line) return;
    setPhase("ready");
    setMsg("Připraveno. Polož balík a stiskni VÁŽIT, nebo TEST TISK ŠTÍTKU.");

    const idx = (linesOnPallet || []).findIndex((l) => l.id === line?.id);
    displayPosRef.current = idx >= 0 ? Math.max(1, idx + 1) : 1;

    setConfirmOpen(false);
    autoTriggeredRef.current = false;
    stableSinceRef.current = null;

    setAltArmed(!!startArmed);
  }, [open, line?.id, ean, startArmed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const v = Number(live?.measurement ?? NaN);
    if (live?.stable && Number.isFinite(v)) {
      if (stableSinceRef.current == null) stableSinceRef.current = Date.now();
    } else {
      stableSinceRef.current = null;
    }
  }, [live?.stable, live?.measurement]);

  const stableHoldOk = (() => {
    const v = Number(live?.measurement ?? NaN);
    if (!live?.stable || !Number.isFinite(v)) return false;
    if (v < (minPlacedKg || 0.2)) return false;
    const since = stableSinceRef.current;
    return since != null && (Date.now() - since >= STABLE_HOLD_MS);
  })();

  const getOrderedBoxes = () => (
    Number.isFinite(Number(line?.ordered_boxes))
      ? Number(line.ordered_boxes)
      : computeOrderedBoxes(line)
  );
  const getScannedBoxesFE = () => Number(line?.scanned_boxes || 0);
  const getMaxAllowed = () => {
    if (Number.isFinite(Number(remainingAtScan))) return Math.max(0, Number(remainingAtScan));
    return Math.max(0, getOrderedBoxes() - getScannedBoxesFE());
  };

  async function readStableMeasurementOrFail(timeoutMs = 7000) {
    const start = Date.now();
    let stableStart = null;
    while (Date.now() - start < timeoutMs) {
      const cur = liveRef.current;
      const v = Number(cur?.measurement ?? NaN);
      const st = !!cur?.stable;
      const okVal = Number.isFinite(v) && v >= (minPlacedKg || 0.2);
      if (st && okVal) {
        if (stableStart == null) stableStart = Date.now();
        if (Date.now() - stableStart >= STABLE_HOLD_MS) {
          return Number(v.toFixed(UI_DECIMALS));
        }
      } else {
        stableStart = null;
      }
      await sleep(50);
    }
    throw new Error("unstable");
  }

  async function printLabel({ out, measured, displayPosition, forRK }) {
    const pdfBase64 = await buildLabelPdfBase64({
      carton_code   : out?.carton_code || out?.cartonCode || null,
      measurement_id: out?.measurement_id ?? null,
      weight        : measured,
      position_to_show: forRK ? RK_CODE_API : Number(displayPosition || 0),
      pallet_slot_id: forRK ? null : (line?.pallet_slot_id ?? null),
      item_code     : line?.item_number || null,
      batch_text    : out?.batch || null,
      slot_name     : slotName || null,
    });
    await printPdfBase64ToLabel(pdfBase64);
  }

  async function saveWithFixedPosition(measured) {
    const pos = Number(displayPosRef.current || 0);
    const data = await saveMeasure({
      line_id: line.id,
      pallet_slot_id: pos === 0 ? null : (line?.pallet_slot_id ?? null),
      measured_weight: measured,
      prep_position: pos,
      pallet_id: palletId ?? null,
      ean: ean ?? null,
    });
    if (data?.line) onLineUpdated?.(data.line);
    return { out: data?.result || null, usedPos: pos, didPatch: !!data?.line };
  }

  const canWeigh = isFinite(live?.measurement) && (live?.measurement ?? 0) >= (minPlacedKg || 0.2);

  const weighNow = async () => {
    if (currentSelNo && scanSelNo && currentSelNo !== scanSelNo) {
      setPhase("error");
      setMsg("Kontext se změnil (jiná paleta/filtr). Prosím naskenuj znovu.");
      return;
    }
    if (getMaxAllowed() < 1) {
      setPhase("error");
      setMsg("Nelze tisknout: zbylých 0 ks k naskenování.");
      return;
    }
    try {
      const measured = await readStableMeasurementOrFail();
      await proceedSave(measured);
    } catch {
      const v = Number(liveRef.current?.measurement ?? NaN);
      if (Number.isFinite(v)) measuredRef.current = Number(v.toFixed(UI_DECIMALS));
      setPhase("error");
      setMsg("Váha nestabilní. Zkus znovu vážit, nebo nastav novou referenční váhu.");
      setConfirmOpen(true);
    }
  };

  async function proceedSave(measured, opts = {}) {
    const force = !!opts.force;
    if (currentSelNo && scanSelNo && currentSelNo !== scanSelNo) {
      setPhase("error");
      setMsg("Kontext se změnil (jiná paleta/filtr). Prosím naskenuj znovu.");
      return;
    }
    if (getMaxAllowed() < 1 && !force) {
      setPhase("error");
      setMsg("Nelze tisknout: zbylých 0 ks k naskenování.");
      return;
    }

    const refKg = Number(line?.gross_weight_ctn_kg ?? NaN);
    const tol   = Number(tolAbs || DEFAULT_TOL_KG);
    const hasRef = Number.isFinite(refKg) && refKg > 0;
    const ok    = force ? true : (hasRef ? Math.abs(measured - refKg) <= tol : false);

    if (!ok) {
      measuredRef.current = measured;
      const refTxt = hasRef ? `${refKg} ± ${tol.toFixed(2)} kg` : "nenastavena";
      setMsg(`MIMO TOLERANCI / CHYBÍ REFERENCE: ${measured.toFixed(UI_DECIMALS)} kg (ref ${refTxt})`);
      try { errorAudio?.current?.play?.(); } catch {}
      setConfirmOpen(true);
      return;
    }

    setPhase("saving");
    setMsg("Ukládám a tisknu…");
    try {
      const { out, usedPos } = await saveWithFixedPosition(measured);

      await printLabel({ out, measured, displayPosition: displayPosRef.current, forRK: false });

      onSaved?.(line.id, measured, usedPos !== RK_CODE_API, 1);
      try { (usedPos === RK_CODE_API ? errorAudio : successAudio)?.current?.play?.(); } catch {}
      onClose?.();
    } catch (e) {
      setPhase("error");
      setMsg(`Chyba ukládání/tisku: ${e?.response?.data?.error || e?.message || e}`);
      try { errorAudio?.current?.play?.(); } catch {}
    }
  }

  async function handleConfirmRK() {
    const measured = Number((measuredRef.current ?? liveRef.current?.measurement ?? 0).toFixed(UI_DECIMALS));
    setConfirmOpen(false);
    setPhase("saving");
    setMsg("Předávám na RK a tisknu…");
    try {
      const data = await saveMeasure({
        line_id: line.id,
        pallet_slot_id: null,
        measured_weight: measured,
        prep_position: RK_CODE_API,
        pallet_id: palletId ?? null,
        ean: ean ?? null
      });
      if (data?.line) onLineUpdated?.(data.line);
      await printLabel({ out: data?.result || null, measured, displayPosition: 0, forRK: true });
      onSaved?.(line.id, measured, false, 1);
      try { errorAudio?.current?.play?.(); } catch {}
      onClose?.();
    } catch (e) {
      setPhase("error");
      setMsg(`Chyba ukládání (RK): ${e?.response?.data?.error || e?.message || e}`);
      try { errorAudio?.current?.play?.(); } catch {}
    }
  }

  async function handleSetAsRef() {
    const useLive = stableHoldOk && Number.isFinite(Number(liveRef.current?.measurement));
    const measured = Number((useLive ? liveRef.current?.measurement : (measuredRef.current ?? 0)).toFixed(UI_DECIMALS));
    setConfirmOpen(false);
    setPhase("saving");
    setMsg("Nastavuji referenční váhu…");
    try {
      const data = await setRefWeight({ line_id: line.id, new_gross_weight_ctn_kg: measured });
      if (data?.line) onLineUpdated?.(data.line);
      else onRefUpdated?.(line.id, measured);
    } catch {}
    await proceedSave(measured, { force: true });
  }

  const handleMultiRun = async (countRequested) => {
    if (!open || !line) return;
    if (phase === "saving") return;

    if (currentSelNo && scanSelNo && currentSelNo !== scanSelNo) {
      setPhase("error");
      setMsg("Kontext se změnil (jiná paleta/filtr). Prosím naskenuj znovu.");
      return;
    }
    const maxAllowed = getMaxAllowed();
    const total = Math.min(Number(countRequested) || 0, maxAllowed);
    if (total <= 0) {
      setPhase("error");
      setMsg("Nelze tisknout: požadavek přesahuje zbývající počet.");
      return;
    }

    let measured;
    try {
      measured = await readStableMeasurementOrFail();
    } catch {
      const v = Number(liveRef.current?.measurement ?? NaN);
      if (Number.isFinite(v)) measuredRef.current = Number(v.toFixed(UI_DECIMALS));
      setPhase("error");
      setMsg("Váha nestabilní. Zkus znovu vážit, nebo nastav novou referenční váhu.");
      setConfirmOpen(true);
      return;
    }

    const refKg = Number(line?.gross_weight_ctn_kg ?? NaN);
    const tol   = Number(tolAbs || DEFAULT_TOL_KG);
    const hasRef = Number.isFinite(refKg) && refKg > 0;
    if (!hasRef) {
      measuredRef.current = measured;
      setPhase("error");
      setMsg("Chybí referenční váha. Nastav ji prosím, nebo předej na RK.");
      setConfirmOpen(true);
      return;
    }

    setPhase("saving");
    setMsg(`Ukládám a tisknu ×${total}…`);
    try {
      let lastUsedPos = displayPosRef.current;
      let patchedIters = 0;

      for (let i = 0; i < total; i++) {
        const ok = Math.abs(measured - refKg) <= tol;
        if (!ok) {
          measuredRef.current = measured;
          setPhase("error");
          setMsg(`MIMO TOLERANCI na iteraci ${i+1}/${total}: ${measured.toFixed(UI_DECIMALS)} kg (ref ${refKg} ± ${tol.toFixed(2)} kg)`);
          setConfirmOpen(true);
          return;
        }
        const { out, usedPos, didPatch } = await saveWithFixedPosition(measured);
        lastUsedPos = usedPos;
        if (didPatch) patchedIters += 1;
        await printLabel({ out, measured, displayPosition: displayPosRef.current, forRK: false });
      }

      const unpatched = Math.max(0, total - patchedIters);
      const countForOnSaved = unpatched + 1; // delta = count - 1 => unpatched

      onSaved?.(line.id, measured, lastUsedPos !== RK_CODE_API, countForOnSaved);
      try { (lastUsedPos === RK_CODE_API ? errorAudio : successAudio)?.current?.play?.(); } catch {}
      onClose?.();
    } catch (e) {
      setPhase("error");
      setMsg(`Chyba multi uložení/tisku: ${e?.response?.data?.error || e?.message || e}`);
      try { errorAudio?.current?.play?.(); } catch {}
    }
  };

  useEffect(() => {
    if (!open || !line) return;
    if (confirmOpen) return;
    if (phase === "saving") return;
    if (autoTriggeredRef.current) return;
    if (!stableHoldOk) return;

    autoTriggeredRef.current = true;

    if (altArmed && Number(presetCount) > 0) {
      const maxAllowed = getMaxAllowed();
      const toRun = Math.min(Number(presetCount), maxAllowed);
      if (currentSelNo && scanSelNo && currentSelNo !== scanSelNo) {
        setPhase("error");
        setMsg("Kontext se změnil (jiná paleta/filtr). Prosím naskenuj znovu.");
        return;
      }
      if (toRun <= 0) {
        setPhase("error");
        setMsg("Nelze tisknout: požadavek přesahuje zbývající počet.");
        return;
      }
      void handleMultiRun(toRun);
      return;
    }

    (async () => {
      try {
        const measured = await readStableMeasurementOrFail();
        await proceedSave(measured);
      } catch {
        const v = Number(liveRef.current?.measurement ?? NaN);
        if (Number.isFinite(v)) measuredRef.current = Number(v.toFixed(UI_DECIMALS));
        setPhase("error");
        setMsg("Váha nestabilní. Zkus znovu vážit, nebo nastav novou referenční váhu.");
        setConfirmOpen(true);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, line?.id, stableHoldOk, confirmOpen, phase, live?.measurement, altArmed, presetCount, currentSelNo, scanSelNo]);

  const scannedBoxes  = Number(line?.scanned_boxes || 0);
  const orderedBoxes  = Number.isFinite(Number(line?.ordered_boxes)) ? Number(line.ordered_boxes) : computeOrderedBoxes(line);
  const positionText = String(displayPosRef.current);

  return (
    <>
      <Dialog open={open} onClose={() => (phase === "saving" ? null : onClose?.())} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          Vážení po skenu
          {altArmed && <Chip size="small" label={presetCount > 0 ? `# ×${presetCount}` : "#"} />}
        </DialogTitle>
        <DialogContent>
          {!line ? (
            <Typography>Neplatný produkt.</Typography>
          ) : (
            <Stack direction="row" spacing={2} alignItems="stretch" sx={{ minHeight: 360 }}>
              <LeftBadge positionText={positionText} />
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
                {(() => {
                  const refKg = Number(line?.gross_weight_ctn_kg ?? NaN);
                  const hasRef = Number.isFinite(refKg) && refKg > 0;
                  return (
                    <Typography sx={{ mt: 0.5 }}>
                      Referenční váha: {hasRef ? `${refKg} kg` : "— (nenastavena)"}
                    </Typography>
                  );
                })()}

                <LiveControls
                  phase={phase}
                  msg={msg}
                  live={live}
                  tolAbs={tolAbs}
                  setTolAbs={setTolAbs}
                  minPlacedKg={minPlacedKg}
                  setMinPlacedKg={setMinPlacedKg}
                  canWeigh={canWeigh}
                  onWeighNow={weighNow}
                  onTestPrint={async () => {
                    try {
                      setPhase("saving");
                      setMsg("Posílám testovací štítek na tisk…");
                      const measured = Number(
                        (isFinite(live?.measurement) ? live.measurement : (line?.gross_weight_ctn_kg ?? 0.123)).toFixed(UI_DECIMALS)
                      );
                      const out = { carton_code: `TEST-${Date.now().toString().slice(-6)}`, measurement_id: 0, batch: null };
                      const pdfBase64 = await buildLabelPdfBase64({
                        carton_code: out.carton_code,
                        measurement_id: 0,
                        weight: measured,
                        position_to_show: Number(displayPosRef.current || 0),
                        pallet_slot_id: line?.pallet_slot_id ?? null,
                        item_code: line?.item_number || null,
                        batch_text: null,
                        slot_name: slotName || null,
                      });
                      await printPdfBase64ToLabel(pdfBase64);
                      try { successAudio?.current?.play?.(); } catch {}
                      onClose?.();
                    } catch (e) {
                      setPhase("error");
                      setMsg(`Chyba tisku (test): ${e?.message || e}`);
                      try { errorAudio?.current?.play?.(); } catch {}
                    }
                  }}
                />
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

      <ConfirmDialog
        open={confirmOpen}
        measured={measuredRef.current}
        refWeight={line?.gross_weight_ctn_kg}
        tolAbs={tolAbs}
        onCancel={() => { setConfirmOpen(false); setPhase("ready"); setMsg("Stornováno. Můžeš pokračovat."); }}
        onConfirmRK={handleConfirmRK}
        onConfirmSetRef={handleSetAsRef}
      />
    </>
  );
}
