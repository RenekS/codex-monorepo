// =============================================================
// File: src/components/InitialInventory.jsx (container)
// =============================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PREVIEW_PREFIX } from '../constants/inventory';
import {
  clean, parseProdFromCode, extractCartonFromRaw, suffixNum, suffixInt, looksLikeQr, uid
} from '../utils/inventoryHelpers';
import {
  useGuard, fetchSlots, fetchSlotStock, peekCode, commitSlotAPI, reassignToUnassignedAPI, patchQtyAPI
} from '../services/api';
import {
  printCreatedLabels, printNewCartonsFallback, printCartonRow, printScanRow
} from '../services/printing';
import SlotFilter from '../components/inventory/SlotFilter';
import ScanPanel from '../components/inventory/ScanPanel';
import SlotCartonsTable from '../components/inventory/SlotCartonsTable';
import ScannedSessionTable from '../components/inventory/ScannedSessionTable';
import SummaryTable from '../components/inventory/SummaryTable';

// 🎵 zvuky – okamžitý feedback
import successSoundFile from '../sounds/success-sound.mp3';
import errorSoundFile from '../sounds/error-sound.mp3';

export default function InitialInventory() {
  const navigate = useNavigate();
  const guard = useGuard();

  const [slots, setSlots] = useState([]);
  const [slotFilter, setSlotFilter] = useState('');
  const [onlyUninventorized, setOnlyUninventorized] = useState(true);
  const [selectedSlotId, setSelectedSlotId] = useState('');

  const [scanInput, setScanInput] = useState('');
  const [scannedRows, setScannedRows] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);

  const [baseline, setBaseline] = useState([]);
  const [currentStock, setCurrentStock] = useState([]);
  const [slotCartons, setSlotCartons] = useState([]);
  const slotCartonSet = useMemo(() => new Set(slotCartons.map(c => c.carton_code)), [slotCartons]);
  const [scannedQrSet, setScannedQrSet] = useState(new Set());
  const inputRef = useRef(null);

  // 🎵 audio refs (preload, play asap)
  const successAudio = useRef(null);
  const errorAudio = useRef(null);
  useEffect(() => {
    successAudio.current = new Audio(successSoundFile);
    errorAudio.current = new Audio(errorSoundFile);
    successAudio.current.preload = 'auto';
    errorAudio.current.preload = 'auto';
  }, []);
  const play = (ref) => {
    try {
      const a = ref.current;
      if (!a) return;
      a.pause(); a.currentTime = 0;
      const p = a.play(); if (p?.catch) p.catch(()=>{});
    } catch {}
  };

  // 🖊️ lokální editace UPC (bez okamžitého ukládání)
  const [editingUpcMap, setEditingUpcMap] = useState({}); // { [uid]: string|number }

  const loadSlots = async (inventFilter) => {
    setLoadingSlots(true);
    try {
      const data = await fetchSlots(guard, { onlyUninventorized: inventFilter });
      if (data?.success && Array.isArray(data.slots)) {
        const onlyNamed = data.slots
          .filter(s => s && clean(s.slot_name).length > 0)
          .sort((a, b) =>
            clean(a.slot_name).localeCompare(clean(b.slot_name), 'cs', { numeric: true })
          );
        setSlots(onlyNamed);
      }
    } catch (e) {
      console.error('Chyba při načítání slotů', e);
    } finally {
      setLoadingSlots(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  useEffect(() => { loadSlots(onlyUninventorized); /* eslint-disable */ }, [onlyUninventorized]);
  useEffect(() => { inputRef.current?.focus(); }, [selectedSlotId, scannedRows]);

  const filteredSlots = useMemo(() => {
    const f = slotFilter.trim().toLowerCase();
    if (!f) return slots;
    return slots.filter(s => String(s.slot_name || '').toLowerCase().includes(f));
  }, [slots, slotFilter]);

  const getSlotName = (slotId) =>
    slots.find(s => String(s.id) === String(slotId))?.slot_name || '';

  const fetchStock = async (slotId) => {
    const data = await fetchSlotStock(guard, slotId);
    if (!data?.success) throw new Error(data?.error || 'Stock nevrátil success');
    return data;
  };

  const rebuildSlotCartons = (summary = []) => {
    const list = [];
    for (const r of summary) {
      const prod = r.product_code;
      const upcProduct = Number(r.units_per_carton || 1);
      const detail = Array.isArray(r.cartons_detail) ? r.cartons_detail : [];
      if (detail.length) {
        for (const d of detail) {
          list.push({
            id: d.id,
            carton_code: clean(d.carton_code),
            product_code: prod,
            scanned: false,
            provisional: false,
            upc: Number(d.qty || 0) > 0 ? Number(d.qty) : upcProduct
          });
        }
      } else {
        const codes = Array.isArray(r.carton_codes) ? r.carton_codes : [];
        for (const code of codes) {
          list.push({
            carton_code: clean(code),
            product_code: prod,
            scanned: false,
            provisional: false,
            upc: upcProduct
          });
        }
      }
    }
    list.sort(
      (a, b) =>
        a.product_code.localeCompare(b.product_code, 'cs', { numeric: true }) ||
        a.carton_code.localeCompare(b.carton_code, 'cs', { numeric: true })
    );
    setSlotCartons(list);
    setScannedQrSet(new Set());
  };

  const loadBaselineForSlot = async (slotId) => {
    const stock = await fetchStock(slotId);
    const summary = stock.summary || [];
    setBaseline(summary);
    setCurrentStock(summary);
    rebuildSlotCartons(summary);
  };

  const onSelectSlot = async (e) => {
    const val = e.target.value;
    setSelectedSlotId(val);
    setScannedRows([]);
    setScanInput('');
    setEditingUpcMap({});
    if (val) {
      try { await loadBaselineForSlot(val); }
      catch (err) {
        console.error('Načtení stavu slotu selhalo', err);
        setBaseline([]); setCurrentStock([]); setSlotCartons([]); setScannedQrSet(new Set());
      }
    }
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const allowedProducts = useMemo(
    () => new Set(baseline.map(b => b.product_code)),
    [baseline]
  );

  const baselineMap = useMemo(() => {
    const m = new Map();
    for (const r of baseline) {
      m.set(r.product_code, {
        cartons: Number(r.balance_cartons_est || 0),
        units: Number(r.balance_units || 0),
        upc: Number(r.units_per_carton || 1)
      });
    }
    return m;
  }, [baseline]);

  const baselineByCode = useMemo(() => {
    const m = new Map();
    for (const c of slotCartons)
      m.set(c.carton_code, { product_code: c.product_code, upc: c.upc, id: c.id });
    return m;
  }, [slotCartons]);

  const guessUpcFromSession = (prod) => {
    const hit = scannedRows.find(r => r.product_code === prod && Number(r.upc || 0) > 0);
    return hit ? Number(hit.upc || 0) : 0;
  };

  const sessionAgg = useMemo(() => {
    const agg = new Map();
    for (const row of scannedRows) {
      const p = row.product_code;
      const cartons = Number(row.impact_cartons || 0);
      if (!p || !cartons) continue;
      const effUpc = Number(row.upc_override ?? row.upc ?? 0) || 1;
      const prev = agg.get(p) || { cartons: 0, units: 0 };
      agg.set(p, { cartons: prev.cartons + cartons, units: prev.units + cartons * effUpc });
    }
    return agg;
  }, [scannedRows]);

  const summaryRows = useMemo(() => {
    const keys = new Set([...Array.from(baselineMap.keys()), ...Array.from(sessionAgg.keys())]);
    const out = [];
    for (const k of keys) {
      const b = baselineMap.get(k) || { cartons: 0, units: 0, upc: 0 };
      const sess = sessionAgg.get(k) || { cartons: 0, units: 0 };
      const upcBase = Number(b.upc || 0) > 0 ? b.upc : (guessUpcFromSession(k) || 1);
      out.push({
        product_code: k,
        upc: upcBase,
        baseline_cartons: b.cartons,
        scanned_cartons: sess.cartons,
        delta_cartons: sess.cartons,
        baseline_units: b.units,
        scanned_units: sess.units,
        delta_units: sess.units
      });
    }
    out.sort((a, b) =>
      clean(a.product_code).localeCompare(clean(b.product_code), 'cs', { numeric: true })
    );
    return out;
  }, [baselineMap, sessionAgg, scannedRows]);

  const toUnassign = summaryRows.filter(r => r.delta_cartons < 0);

  const nextPreviewCartonForProduct = (product_code) => {
    let max = 0;
    for (const c of slotCartons) {
      if (c.product_code === product_code) max = Math.max(max, suffixNum(c.carton_code));
    }
    const next = String(max + 1).padStart(4, '0');
    return `${PREVIEW_PREFIX}-${product_code}-${next}`;
  };

  // ============ GLOBÁLNÍ POSLOUCHAČ SCANNERU ============
  useEffect(() => {
    let buf = '';
    let lastTs = 0;
    let idleTimer = null;
    let lastFinalizeTs = 0;

    const MIN_LEN = 6;
    const END_KEYS = new Set(['Enter', 'NumpadEnter', 'Tab']);
    const MAX_CHAR_GAP = 35;
    const IDLE_FINALIZE = 80;
    const INTER_CODE_COOLDOWN = 60;

    const isEditableTarget = (t) => {
      if (!t) return false;
      return (
        t.tagName === 'INPUT' ||
        t.tagName === 'TEXTAREA' ||
        t.tagName === 'SELECT' ||
        t.isContentEditable
      );
    };

    const finalize = () => {
      const now = performance.now();
      if (now - lastFinalizeTs < INTER_CODE_COOLDOWN) return;
      const code = buf.trim();
      buf = '';
      lastTs = 0;
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
      if (code.length >= MIN_LEN && selectedSlotId) {
        // 🔊 okamžitý zvuk po dokončení scanu
        play(successAudio);
        processScanCode(code);
        lastFinalizeTs = now;
      }
    };

    const scheduleIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (buf.length >= MIN_LEN) finalize();
        else { buf = ''; lastTs = 0; }
      }, IDLE_FINALIZE);
    };

    const onKey = (e) => {
      if (isEditableTarget(e.target)) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const key = e.key;

      if (END_KEYS.has(key)) {
        if (buf.length >= MIN_LEN) {
          e.preventDefault(); e.stopPropagation();
          finalize();
        } else {
          buf = ''; lastTs = 0;
        }
        return;
      }

      if (key && key.length === 1) {
        const now = e.timeStamp || performance.now();
        const gap = now - (lastTs || 0);
        if (buf.length > 0 && gap > MAX_CHAR_GAP * 3) {
          finalize();
        }
        buf += key;
        lastTs = now;
        e.preventDefault();
        e.stopPropagation();
        scheduleIdle();
      }
    };

    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [selectedSlotId]); // eslint-disable-line
  // ======================================================

  const processScanCode = async (rawInput) => {
    const raw = String(rawInput || '').trim();
    if (!raw || !selectedSlotId) return;

    const qrFromRaw = extractCartonFromRaw(raw);
    const isLikelyQr = looksLikeQr(qrFromRaw);

    // duplicitní QR → pípni error a skonči
    if (isLikelyQr && scannedQrSet.has(qrFromRaw)) {
      play(errorAudio);
      return;
    }

    try {
      const data = await peekCode(guard, { slotId: Number(selectedSlotId), code: raw });
      if (data?.success) {
        const kind = data.kind || 'unknown';
        const product_code = data.product_code || (kind?.startsWith('qr') ? parseProdFromCode(qrFromRaw) : '');
        const upcFromPeek = Number(data.upc || 0) || 0;
        const impact = Number(data.impact_cartons || 0);
        const rowUid = uid();

        if (kind === 'qr_same_slot') {
          const qr = qrFromRaw;
          const base = baselineByCode.get(qr);
          const measurementId = base?.id;
          const upcEff = upcFromPeek || base?.upc || 1;
          setSlotCartons(prev => prev.map(c => c.carton_code === qr ? { ...c, scanned: true } : c));
          setScannedQrSet(prev => new Set(prev).add(qr));
          setScannedRows(prev => [...prev, { uid: rowUid, raw: qr, kind, product_code, upc: upcEff, impact_cartons: 0, error: '', measurementId }]);
        } else if (kind === 'qr_other_slot' || kind === 'qr_new') {
          const qr = qrFromRaw;
          const bad = allowedProducts.size > 0 && !allowedProducts.has(product_code);

          // ⬇️ nově: measurement id z BE, pokud je; jinak z baseline aktuálního slotu
          const base = baselineByCode.get(qr);
          const measurementId = data.measurement_id ?? base?.id ?? null;

          // ⬇️ nově: lepší fallback na UPC
          const upcFromBaselineForProduct = baselineMap.get(product_code)?.upc || 0;
          const upcEff = upcFromPeek || upcFromBaselineForProduct || base?.upc || 1;

          setScannedRows(prev => {
            if (scannedQrSet.has(qr)) return prev;
            return [...prev, {
              uid: rowUid,
              raw: qr,
              kind,
              product_code,
              upc: upcEff,
              impact_cartons: impact,
              error: bad ? 'Produkt v tomto slotu dosud není' : '',
              bad,
              measurementId
            }];
          });
          setScannedQrSet(prev => new Set(prev).add(qr));
        } else if (kind === 'ean_mapped') {
          const preview = nextPreviewCartonForProduct(product_code);
          const upcEff = upcFromPeek || 1;
          if (!slotCartonSet.has(preview)) {
            setSlotCartons(prev => {
              const next = [...prev, { carton_code: preview, product_code, scanned: true, provisional: true, upc: upcEff }];
              next.sort(
                (a, b) =>
                  a.product_code.localeCompare(b.product_code, 'cs', { numeric: true }) ||
                  a.carton_code.localeCompare(b.carton_code, 'cs', { numeric: true })
              );
              return next;
            });
          }
          setScannedRows(prev => [...prev, { uid: rowUid, raw, kind, product_code, upc: upcEff, impact_cartons: impact, error: '', preview_carton_code: preview }]);
        } else {
          setScannedRows(prev => [...prev, { uid: rowUid, raw, kind:'unknown', product_code:'', upc:0, impact_cartons:0, error: data.error || '' }]);
          // chybový tón navrch (už zazněl „scan“)
          play(errorAudio);
        }
      } else {
        setScannedRows(prev => [...prev, { uid: uid(), raw, kind:'unknown', product_code:'', upc:0, impact_cartons:0, error:'peek fail' }]);
        play(errorAudio);
      }
    } catch (err) {
      console.error('peek error', err);
      setScannedRows(prev => [...prev, { uid: uid(), raw, kind:'unknown', product_code:'', upc:0, impact_cartons:0, error:'peek error' }]);
      play(errorAudio);
    }
  };

  const onScanManualSubmit = async (e) => {
    e.preventDefault();
    if (!scanInput) return;
    // stejné chování jako scanner: pípni hned
    play(successAudio);
    await processScanCode(scanInput);
    setScanInput('');
  };

  // === UPC edit/uložení (žádný debounce; ukládáme až na blur/Enter) ===
  const changeRowUpc = (uidKey, val) => {
    setEditingUpcMap(prev => ({ ...prev, [uidKey]: val }));
  };

  const cancelRowUpc = (uidKey) => {
    setEditingUpcMap(prev => {
      const { [uidKey]: _, ...rest } = prev;
      return rest;
    });
  };

  const saveRowUpc = async (uidKey) => {
    // najdi řádek podle uid
    const idx = scannedRows.findIndex(r => r.uid === uidKey);
    if (idx < 0) return;
    const row = scannedRows[idx];
    const rawVal = editingUpcMap[uidKey];
    const val = Number(rawVal ?? row.upc ?? 0) || 0;

    try {
      if (looksLikeQr(row.raw)) {
        const measurementId = row.measurementId ?? baselineByCode.get(row.raw)?.id;

        if (measurementId) {
          try {
            await patchQtyAPI(guard, measurementId, val);
          } catch (e) {
            console.error('PATCH qty error', e);
            alert('Uložení Ks/krabici selhalo.');
            // i když PATCH selže, pokračujeme lokálním přepisem,
            // ať uživatel nepřijde o hodnotu
          }
          // přepiš i levou tabulku (pokud krabice v seznamu je)
          setSlotCartons(prev => prev.map(c =>
            c.carton_code === row.raw ? { ...c, upc: val } : c
          ));
        }

        // vždy lokálně ulož UPC v řádku relace
        setScannedRows(prev => {
          const copy = prev.slice();
          copy[idx] = { ...row, upc: val, upc_override: undefined };
          return copy;
        });
      } else {
        // non-QR → lokální update
        if (row.preview_carton_code) {
          setSlotCartons(prev => prev.map(c =>
            c.carton_code === row.preview_carton_code ? { ...c, upc: val } : c
          ));
        }
        setScannedRows(prev => {
          const copy = prev.slice();
          copy[idx] = { ...row, upc: val, upc_override: undefined };
          return copy;
        });
      }
    } finally {
      // vyčisti lokální edit
      setEditingUpcMap(prev => {
        const { [uidKey]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const deleteScanAt = (idx) => {
    setScannedRows(prev => {
      const row = prev[idx];
      if (!row) return prev;
      const next = prev.slice(0, idx).concat(prev.slice(idx + 1));
      if (row.kind === 'qr_same_slot') {
        setSlotCartons(list => list.map(c => c.carton_code === row.raw ? { ...c, scanned: false } : c));
        setScannedQrSet(set => { const s = new Set(set); s.delete(row.raw); return s; });
      } else if (row.kind === 'qr_other_slot' || row.kind === 'qr_new') {
        setScannedQrSet(set => { const s = new Set(set); s.delete(row.raw); return s; });
      } else if (row.kind === 'ean_mapped' && row.preview_carton_code) {
        setSlotCartons(list => list.filter(c => !(c.provisional && c.carton_code === row.preview_carton_code)));
      }
      // případně smaž rozpracovanou editaci UPC pro daný uid
      setEditingUpcMap(prev => {
        const { [row.uid]: _, ...rest } = prev;
        return rest;
      });
      return next;
    });
  };

  const commitSlot = async () => {
    if (!selectedSlotId || scannedRows.length === 0) return;
    setSaving(true);
    try {
      const payload = {
        slotId: Number(selectedSlotId),
        npHeaderId: 20,
        scans: scannedRows.map(r => ({
          code: r.raw,
          kind: r.kind,
          product_code: r.product_code || null,
          upc: Number(editingUpcMap[r.uid] ?? r.upc ?? 0) || 1
        }))
      };

      const data = await commitSlotAPI(guard, payload);

      if (data?.success) {
        let created =
          data.created_details ||
          data.createdCartons ||
          data.created ||
          data.newly_created ||
          data.created_codes ||
          [];
        let printed = false;

        if (Array.isArray(created) && created.length) {
          if (typeof created[0] === 'string') {
            printed = await printNewCartonsFallback({
              scans: created,
              slotId: payload.slotId,
              getSlotName
            });
          } else {
            const toPrint = created.map(row => ({
              id: row.id,
              carton_code: row.carton_code || row.code,
              product_code:
                row.product_code ||
                row.item_number ||
                (row.carton_code ? row.carton_code.split('-')[1] : ''),
              slot_id: row.slot_id || payload.slotId,
              slot_name: row.slot_name || getSlotName(payload.slotId),
              carton_index:
                (row.carton_index != null)
                  ? row.carton_index
                  : (row.carton_code || row.code
                    ? (row.carton_code || row.code).match(/(\d+)\s*$/)?.[1]
                      ? parseInt((row.carton_code || row.code).match(/(\d+)\s*$/)[1], 10)
                      : null
                    : null)
            })).filter(x => x && x.carton_code);
            if (toPrint.length) {
              try { await printCreatedLabels(toPrint); printed = true; }
              catch (e) { console.error('Tisk created selhal:', e); }
            }
          }
        }
        if (!printed) {
          const eanCreated = scannedRows
            .filter(r => r.kind === 'ean_mapped' && r.preview_carton_code)
            .map(r => ({
              id: null,
              carton_code: r.preview_carton_code,
              product_code:
                r.product_code || (r.preview_carton_code.split('-')[1] || ''),
              slot_id: payload.slotId,
              slot_name: getSlotName(payload.slotId),
              carton_index:
                (r.preview_carton_code.match(/(\d+)\s*$/)?.[1]
                  ? parseInt(r.preview_carton_code.match(/(\d+)\s*$/)[1], 10)
                  : null)
            }));
          if (eanCreated.length) {
            try { await printCreatedLabels(eanCreated); }
            catch (e) { console.error('Fallback tisk selhal:', e); }
          }
        }

        // ✅ Lokálně označ slot jako inventarizovaný (bez reloadu)
        setSlots(prev => {
          const updated = prev.map(s =>
            String(s.id) === String(selectedSlotId)
              ? { ...s, inventarisation: '1', inventarised: 1 }
              : s
          );
          return onlyUninventorized
            ? updated.filter(s => String(s.id) !== String(selectedSlotId))
            : updated;
        });

        if (onlyUninventorized) {
          setSelectedSlotId('');
          setBaseline([]); setCurrentStock([]); setSlotCartons([]); setScannedQrSet(new Set());
          setScannedRows([]);
          setEditingUpcMap({});
        } else {
          const stock = await fetchStock(selectedSlotId);
          const summary = stock.summary || [];
          setCurrentStock(summary);
          setBaseline(summary);
          rebuildSlotCartons(summary);
          setScannedRows([]);
          setEditingUpcMap({});
        }

        const createdCnt = data.created_count ??
          (Array.isArray(created) ? created.length : 0) ??
          scannedRows.filter(r => r.kind === 'ean_mapped' && r.preview_carton_code).length;

        // 🔊 success
        play(successAudio);
        alert(`OK • přesunuto: ${data.moved_count || 0}, založeno: ${createdCnt}, do NEZARAZENO: ${data.unassigned_count || 0}`);
      } else {
        // 🔊 error
        play(errorAudio);
        alert(data?.message || 'Commit se nepodařil.');
      }
    } catch (e) {
      console.error('Commit error', e);
      play(errorAudio);
      alert('Chyba při potvrzení příjmu (viz konzole).');
    } finally {
      setSaving(false);
      inputRef.current?.focus();
    }
  };

  const reassignMissingToUnassigned = async () => {
    if (!selectedSlotId) return;
    const rows = summaryRows
      .filter(r => r.delta_cartons < 0)
      .map(r => ({ product_code: r.product_code, cartons: Math.abs(r.delta_cartons) }));
    if (!rows.length) { alert('Není co přeřazovat.'); return; }
    if (!window.confirm('Přeřadit chybějící do slotu NEZARAZENO?')) return;

    try {
      await reassignToUnassignedAPI(guard, { fromSlotId: Number(selectedSlotId), rows, strategy: 'oldest' });
      const stock = await fetchStock(selectedSlotId);
      const summary = stock.summary || [];
      setCurrentStock(summary);
      setBaseline(summary);
      rebuildSlotCartons(summary);
      alert('Přeřazení hotovo.');
    } catch (e) {
      console.error('Reassign error', e);
      alert('Přeřazení selhalo.');
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Počáteční inventura</h2>

      <ScanPanel
        onManualSubmit={onScanManualSubmit}
        scanInput={scanInput}
        setScanInput={setScanInput}
        saving={saving}
        inputRef={inputRef}
      />

      <SlotFilter
        slotFilter={slotFilter}
        setSlotFilter={setSlotFilter}
        onlyUninventorized={onlyUninventorized}
        setOnlyUninventorized={setOnlyUninventorized}
        selectedSlotId={selectedSlotId}
        onSelectSlot={onSelectSlot}
        filteredSlots={filteredSlots}
        slots={slots}
        loadingSlots={loadingSlots}
      />

      {selectedSlotId && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, alignItems:'start', maxWidth:1400 }}>
            <SlotCartonsTable
              slotCartons={slotCartons}
              onPrint={(c) => printCartonRow({ cartonRow: c, selectedSlotId, getSlotName })}
            />
            <div>
              <div style={{ marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={commitSlot}
                  disabled={saving || scannedRows.length === 0}
                  style={{ padding: '6px 10px', background:'#2e7d32', color:'#fff', border:'none', borderRadius:4 }}
                  title="QR stejný slot → Δ=0; QR jiný slot → přesun; EAN → dočasná šarže v UI; ostrá při commitu"
                >
                  Potvrdit příjem do tohoto slotu
                </button>
              </div>
              <ScannedSessionTable
                scannedRows={scannedRows}
                // nové props pro stabilní editaci UPC
                editingUpcMap={editingUpcMap}
                changeRowUpc={changeRowUpc}          // (uid, val)
                saveRowUpc={saveRowUpc}              // (uid)
                cancelRowUpc={cancelRowUpc}          // (uid)
                deleteScanAt={deleteScanAt}
                onPrint={(row) => printScanRow({ row, selectedSlotId, getSlotName, parseProdFromCode, looksLikeQr, suffixInt })}
              />
            </div>
          </div>

          <SummaryTable
            summaryRows={summaryRows}
            onReassign={reassignMissingToUnassigned}
            toUnassign={toUnassign}
            selectedSlotId={selectedSlotId}
          />
        </>
      )}
    </div>
  );
}
