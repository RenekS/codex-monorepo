import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

import useBarcodeScanner from "./useBarcodeScanner";
import useScaleGate from "./useScaleGate";

import { normalizeEAN, computeOrderedBoxes } from "../utils/np";

import changeSound  from "../sounds/change.mp3";
import successSound from "../sounds/success-sound.mp3";
import errorSound   from "../sounds/error-sound.mp3";

const API_BASE = process.env.REACT_APP_API_URL || "";

// přirozené seřazení: se slot_name dopředu, pak podle slot_name (natural), jinak podle product_kod2/item_number
function sortKey(line) {
  return (line.slot_name?.trim() || line.product_kod2 || line.item_number || "").toString();
}
function sortLinesArray(arr = []) {
  return [...arr].sort((a, b) => {
    const aHas = !!a.slot_name?.trim();
    const bHas = !!b.slot_name?.trim();
    if (aHas !== bHas) return aHas ? -1 : 1;
    return sortKey(a).localeCompare(sortKey(b), "cs", { numeric: true, sensitivity: "base" });
  });
}

export default function useNPDetailLogic(id) {
  // data
  const [header, setHeader]   = useState(null);
  const [pallets, setPallets] = useState([]);
  const [lines, setLines]     = useState({});
  const [loading, setLoading] = useState(true);

  // UI stav
  const [collapsed, setCollapsed] = useState(false);
  const [selNo, setSelNo] = useState("");

  // vážicí dialog (ruční – WeightDialog)
  const [modalOpen, setModalOpen]   = useState(false);
  const [modalLine, setModalLine]   = useState(null);
  const [modalPallet, setModalPallet] = useState(null);
  const [manualWeight, setManualWeight] = useState("");

  // modal po skenu (ScanWeighModal)
  const [scanOpen, setScanOpen] = useState(false);
  const [scanCtx, setScanCtx]   = useState(null);
  // tajný start + preset N pro ScanWeighModal
  const [scanStartArmed, setScanStartArmed] = useState(false);
  const [scanPresetCount, setScanPresetCount] = useState(0);

  // --- NOVÉ: tajný režim ALT+9321 → dialog s počtem N ---
  const [secretAskOpen, setSecretAskOpen] = useState(false);
  const [secretCount, setSecretCount] = useState(10);

  const SECRET_CODE = "9321";
  const ALT_TTL_MS = 700;
  const altBufRef = useRef("");
  const altTimerRef = useRef(null);

  // snack
  const [snack, setSnack] = useState({ open:false, msg:"", sev:"success" });

  // zvuky
  const changeAudio  = useRef(typeof Audio !== "undefined" ? new Audio(changeSound)  : null);
  const successAudio = useRef(typeof Audio !== "undefined" ? new Audio(successSound) : null);
  const errorAudio   = useRef(typeof Audio !== "undefined" ? new Audio(errorSound)   : null);

  // gate nad skenerem podle váhy (povol sken jen při stabilní 0 kg; po uložení zamkni, dokud 0 kg nedrží 5 s)
  const { canAcceptScan, lockUntilZero } = useScaleGate();
  
  // Součty per fyzická paleta (id)
  const palletIdStats = useMemo(() => {
    const acc = {};
    for (const p of pallets) {
      const arr = lines[p.id] || [];
      const sums = arr.reduce((s, l) => {
        const scanned = Number(l.scanned_boxes || 0);
        const ordered = Number(
          Number.isFinite(Number(l?.ordered_boxes)) ? l.ordered_boxes : 0
        );
        s.scanned += scanned;
        s.ordered += ordered;
        return s;
      }, { scanned:0, ordered:0 });

      acc[p.id] = sums;
    }
    return acc;
  }, [pallets, lines]);

  // Součty per "pallet_no" (tlačítka ve filtru)
  const palletNoStats = useMemo(() => {
    const acc = {};
    for (const p of pallets) {
      const key = String(p.pallet_no);
      const s = palletIdStats[p.id] || { scanned:0, ordered:0 };
      if (!acc[key]) acc[key] = { scanned:0, ordered:0 };
      acc[key].scanned += s.scanned;
      acc[key].ordered += s.ordered;
    }
    return acc; // např. { "A1": {scanned:12, ordered:20}, "A2": {...} }
  }, [pallets, palletIdStats]);

  // init fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/np/detail/${id}`);
        if (cancelled) return;

        setHeader(data.header);

        const plts = (data.pallets || []).map(p => ({ ...p, checked: !!p.checked }));
        setPallets(plts);

        // Fallback mapa pro případy, kdy bys chtěl číst ze scanned_summary
        const sumMap = new Map(
          (data.scanned_summary || []).map(r => [
            `${r.pallet_id}:${r.line_id}`,
            Number(r.scanned_count) || 0
          ])
        );

        const grouped = {};
        plts.forEach(p => {
          const arr = (p.lines || []).map(l => {
            // DB → preferuj přímo l.scanned_count; jinak fallback ze scanned_summary
            const scannedFromDB = Number(l.scanned_count ?? NaN);
            const scannedFromSummary = sumMap.get(`${p.id}:${l.id}`);
            const scanned_boxes = Number.isFinite(scannedFromDB)
              ? scannedFromDB
              : (Number(scannedFromSummary) || 0);

            return {
              ...l,
              scanned_boxes,
              weight       : l.weight || "",
              tk_nazev     : l.tk_nazev || l.popis || "—",
              tk_pozice    : l.tk_pozice || null,
            };
          });

          grouped[p.id] = sortLinesArray(arr);
        });

        setLines(grouped);
      } catch (e) {
        console.error("❌ fetch detail", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // --- NOVÉ: globální listener ALT+9321 -> otevři dialog s N ---
  useEffect(() => {
    const onKey = (e) => {
      if (!e.altKey) return;
      if (!/^[0-9]$/.test(e.key)) return;
      e.stopPropagation();
      e.preventDefault();
      altBufRef.current += e.key;
      if (altTimerRef.current) clearTimeout(altTimerRef.current);
      altTimerRef.current = setTimeout(() => {
        const code = altBufRef.current;
        altBufRef.current = "";
        if (code === SECRET_CODE) setSecretAskOpen(true);
      }, ALT_TTL_MS);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKey, { capture: true });
      if (altTimerRef.current) clearTimeout(altTimerRef.current);
    };
  }, []);

  // helpers: patch/boxes/weight
  const patchLine = (lineId, patch) => {
    setLines(prev => {
      const out = {};
      for (const pid in prev) {
        const updated = prev[pid].map(l => (l.id === lineId ? { ...l, ...patch } : l));
        out[pid] = sortLinesArray(updated);
      }
      return out;
    });
  };

  const updateBoxes = (lineId, count) => {
    setLines(prev => {
      const out = {};
      for (const pid in prev) {
        const updated = prev[pid].map(l => (l.id === lineId ? { ...l, scanned_boxes: count } : l));
        out[pid] = sortLinesArray(updated);
      }
      return out;
    });
  };

  const saveWeight = (lineId, weight) => {
    setLines(prev => {
      const out = {};
      for (const pid in prev) {
        const updated = prev[pid].map(l => (l.id === lineId ? { ...l, weight } : l));
        out[pid] = sortLinesArray(updated);
      }
      return out;
    });
    axios.post(`${API_BASE}/np/weight-save`, { line_id: lineId, weight }).catch(()=>{});
  };

  // seřazené řádky a pozice (prep_position) podle seřazení
  const getSortedLines = (palletId) => sortLinesArray(lines[palletId] || []);
  const getPrepPosition = (palletId, lineId) => {
    const arr = getSortedLines(palletId);
    const idx = arr.findIndex(l => l.id === lineId);
    return idx >= 0 ? (idx + 1) : null; // bez limitu 20
  };

  // otevření ručního vážicího dialogu (WeightDialog)
  const showModal = (l, pid) => {
    setModalLine(l);
    setModalPallet(pid);
    setManualWeight(l.weight || "");
    setModalOpen(true);
  };

  // + / − počty krabic v tabulce
  const inc = (pid, lid) => {
    const line = (lines[pid] || []).find(l => l.id === lid);
    if (!line) return;
    const nb = Number(line.scanned_boxes || 0) + 1;
    updateBoxes(lid, nb);
    try { changeAudio.current?.play(); } catch {}
    const ordered = Number.isFinite(Number(line?.ordered_boxes))
      ? Number(line.ordered_boxes)
      : computeOrderedBoxes(line);
    if (nb === ordered) try { successAudio.current?.play(); } catch {}
    if (nb > ordered)   try { errorAudio.current?.play(); } catch {}
    showModal({ ...line, scanned_boxes: nb }, pid);
  };

  const dec = (pid, lid) => {
    const line = (lines[pid] || []).find(l => l.id === lid);
    if (!line) return;
    const nb = Math.max(Number(line.scanned_boxes || 0) - 1, 0);
    updateBoxes(lid, nb);
    try { changeAudio.current?.play(); } catch {}
  };

  // uložení z WeightDialog (ruční měření)
  const handleModalOk = async () => {
    if (!modalLine) return;
    const measured = manualWeight;
    saveWeight(modalLine.id, measured);

    const prep_position = getPrepPosition(modalPallet, modalLine.id) ?? 1;

    try {
      const { data } = await axios.post(`${API_BASE}/np/measure`, {
        line_id        : modalLine.id,
        pallet_slot_id : modalLine.pallet_slot_id || null,
        measured_weight: measured || 0,
        prep_position,
        user_id        : 1,
      });
      // Backend může vrátit aktualizovanou řádku včetně nového scanned_count
      if (data?.line) {
        const nextScanned = Number(data.line.scanned_count ?? data.line.scanned_boxes ?? NaN);
        patchLine(data.line.id, {
          ...data.line,
          ...(Number.isFinite(nextScanned) ? { scanned_boxes: nextScanned } : {})
        });
      }
      setSnack({ open:true, msg:"Měření uloženo", sev:"success" });
    } catch (e) {
      console.error("❌ measure", e);
      setSnack({ open:true, msg:"Chyba při ukládání měření", sev:"error" });
    }
    setModalOpen(false);
  };

  // sken — vyhledání řádku v právě vybrané paletě podle EAN
  function findLineByEANInSelectedPallet(eanRaw) {
    if (!selNo) return null;
    const ean = normalizeEAN(eanRaw);
    const selectedPallets = pallets.filter(p => p.pallet_no === selNo);
    for (const pal of selectedPallets) {
      const lst = lines[pal.id] || [];
      const l = lst.find(x => {
        const eanKrab = normalizeEAN(x.tk_ean_krabice);
        return eanKrab && eanKrab === ean;
      });
      if (l) return { line: l, palletId: pal.id };
    }
    return null;
  }

  // sken – povol pouze při stabilní 0 kg (gate); po uložení se gate zamkne (viz handleScanSaved)
  useBarcodeScanner((ean) => {
    const code = String(ean || "").trim();

    if (!selNo) {
      setSnack({ open:true, msg:"Nejprve vyber paletu nahoře.", sev:"error" });
      try { errorAudio.current?.play(); } catch {}
      return;
    }
    if (!canAcceptScan) {
      setSnack({ open:true, msg:"Sken zablokován: nejprve sundej balík a počkej na 0 kg.", sev:"error" });
      try { errorAudio.current?.play(); } catch {}
      return;
    }

    const found = findLineByEANInSelectedPallet(code);
    if (!found) {
      setSnack({ open:true, msg:`EAN ${normalizeEAN(code)} nepatří do zvolené palety`, sev:"error" });
      try { errorAudio.current?.play(); } catch {}
      return;
    }

    // ihned po skenu přičíst 1 krabici + zvuk (optimisticky)
    updateBoxes(found.line.id, Number(found.line.scanned_boxes || 0) + 1);
    try { changeAudio.current?.play(); } catch {}

    // otevřít modal pro vážení a tisk
    // remaining před optimistickým +1
    const preCount = Number(found.line.scanned_boxes || 0);
    const ordered  = Number.isFinite(Number(found.line?.ordered_boxes))
      ? Number(found.line.ordered_boxes)
      : computeOrderedBoxes(found.line);
    const remainingAtScan = Math.max(0, ordered - preCount);
    // otevřít modal pro vážení a tisk (ulož i kontext v okamžiku skenu)
    setScanCtx({ ...found, ean: normalizeEAN(code), remainingAtScan, selNoAtScan: selNo });
    setScanOpen(true);
  }, 100);

  // callbacky z ScanWeighModal
  const handleScanSaved = (lineId, measured, ok, count = 1) => {
    const delta = Math.max(0, Number(count) - 1);
    if (delta > 0) {
      setLines(prev => {
        const out = {};
        for (const pid in prev) {
          out[pid] = (prev[pid] || []).map(l => (l.id === lineId ? { ...l, scanned_boxes: Number(l.scanned_boxes || 0) + delta } : l));
        }
        return out;
      });
    }
    saveWeight(lineId, measured);
    try { (ok ? successAudio : errorAudio).current?.play(); } catch {}
    // zamkni skener, dokud nebude 0 kg držena X sekund (viz useScaleGate)
    lockUntilZero();
  };

  const handleLineUpdated = (line) => {
    if (!line?.id) return;
    const nextScanned = Number(line.scanned_count ?? line.scanned_boxes ?? NaN);
    patchLine(line.id, {
      ...line,
      ...(Number.isFinite(nextScanned) ? { scanned_boxes: nextScanned } : {})
    });
  };
  const handleRefUpdated  = (lineId, newGross) => { patchLine(lineId, { gross_weight_ctn_kg: newGross }); };

  // palety – přepínač "Zkontrolováno"
  const toggleChecked = async (pallet) => {
    try {
      await axios.post(`${API_BASE}/np/pallet-check`, { pallet_id: pallet.id, checked: !pallet.checked });
      setPallets(ps => ps.map(x => x.id === pallet.id ? { ...x, checked: !x.checked } : x));
    } catch (e) {
      console.warn("pallet-check:", e?.response?.data || e);
    }
  };

  // při změně filtru zruš „tajných“ ozbrojení a preset
  useEffect(() => { setScanStartArmed(false); setScanPresetCount(0); }, [selNo]);

  // --- NOVÉ: potvrzení/rušení dialogu ALT režimu ---
  const confirmSecretCount = () => {
    const n = Math.max(1, Math.min(999, Number(secretCount) || 1));
    setSecretCount(n);
    setSecretAskOpen(false);
    setScanPresetCount(n);
    setScanStartArmed(true);
    setSnack({ open:true, msg:`Rychlý tisk: # ×${n} připraven.`, sev:"success" });
  };
  const cancelSecretCount = () => {
    setSecretAskOpen(false);
    setScanStartArmed(false);
    setScanPresetCount(0);
  };

  // derived
  const uniqNos = useMemo(() => [...new Set(pallets.map(p => p.pallet_no))], [pallets]);
  const viewPallets = useMemo(
    () => (selNo ? pallets.filter(p => p.pallet_no === selNo) : pallets),
    [pallets, selNo]
  );

  return {
    // data
    header, pallets, lines, loading, uniqNos, viewPallets,

    // UI stav
    collapsed, setCollapsed, selNo, setSelNo,

    // ruční vážení (WeightDialog)
    modalOpen, modalLine, modalPallet, manualWeight,
    setManualWeight, setModalOpen, handleModalOk,

    // sken modal (ScanWeighModal)
    scanOpen, setScanOpen, scanCtx, setScanCtx,
    scanStartArmed, setScanStartArmed,
    scanPresetCount, setScanPresetCount,

    // ALT dialog (Rychlý tisk N)
    secretAskOpen, setSecretAskOpen,
    secretCount, setSecretCount,
    confirmSecretCount, cancelSecretCount,

    // akce v tabulce
    inc, dec, updateBoxes, saveWeight, patchLine, toggleChecked,

    // callbacky ze ScanWeighModal
    handleScanSaved, handleLineUpdated, handleRefUpdated,

    // snackbar
    snack, setSnack,

    // zvuky
    successAudio, errorAudio,

    // helpers
    getSortedLines, getPrepPosition,
    computeOrderedBoxes,

    // nové statistiky
    palletNoStats,  // pro PalletSelector
    palletIdStats,  // pro případné další použití
  };
}
