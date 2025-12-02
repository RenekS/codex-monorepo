// src/hooks/useOrderScanRouter.js
import { useRef } from 'react';
import { parseQrPayload, s, decodeCartonCode } from '../utils/qr';
import { playSound } from '../utils/sound';
import { resolveCarton } from '../services/wmsApi';

// === Backend base URL pro /wms/scanlog (fetch) ===
const API_BASE =
  (typeof process !== 'undefined' && process.env && (process.env.REACT_APP_API_BASE || process.env.REACT_APP_API_URL)) ||
  (typeof window !== 'undefined' && window.__API_BASE__) ||
  (typeof localStorage !== 'undefined' && localStorage.getItem && localStorage.getItem('API_BASE')) ||
  (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3000` : 'http://localhost:3001');

const api = (p) => (API_BASE ? `${API_BASE}${p.startsWith('/') ? p : `/${p}`}` : p);

// --- scan logging helper ---
function logScanEvent(evt) {
  try {
    const rawCarton = evt?.carton_code || evt?.cartonCode || null;
    const dc = rawCarton ? decodeCartonCode(rawCarton) : null;
    const payload = {
      ...evt,
      product_code: dc ? dc.productCode : undefined,
      box_number: dc ? dc.boxNumber : undefined,
      np_code: dc ? dc.npCode : undefined,
      ts: new Date().toISOString(),
      href: (typeof window !== 'undefined' && window.location ? window.location.href : ''),
      ua: (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : ''
    };
    fetch(api('/wms/scanlog'), {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  } catch (_) { /* noop */ }
}

function getOrderNumberFromLocation() {
  try {
    if (typeof window === 'undefined') return null;
    const m = window.location.pathname.match(/\/order\/([^/?#]+)/i);
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
}

// otevře modal + vyplní adjustCtx.qty
async function openDirect(ctx, it, cartonCode, qty) {
  const {
    setPendingCarton, setPickMode, setCompleteMode,
    incompleteItems, sortedItems, setCompleteIndex,
    setFocusedItemId, setScanInfo, setAdjustCtx
  } = ctx;

  if (typeof setPendingCarton === 'function') setPendingCarton(String(cartonCode));
  if (typeof setPickMode === 'function') setPickMode('direct');

  if (typeof setAdjustCtx === 'function') {
    const maxQty = Number(it?.SalesQty) || 0;
    const initial = Math.max(0, Math.min(Number(qty) || 0, maxQty));
    setAdjustCtx({ itemId: it.ItemId, unit: 'pouch', qty: initial });
  }

  if (typeof setCompleteMode === 'function') setCompleteMode(true);
  const inc = Array.isArray(incompleteItems) ? incompleteItems : [];
  const sort = Array.isArray(sortedItems) ? sortedItems : [];
  const idxInc = inc.findIndex(x => x?.ItemId === it?.ItemId);
  const idxSort = sort.findIndex(x => x?.ItemId === it?.ItemId);
  if (typeof setCompleteIndex === 'function') {
    setCompleteIndex(idxInc >= 0 ? idxInc : (idxSort >= 0 ? idxSort : 0));
  }
  if (typeof setFocusedItemId === 'function') setFocusedItemId(it?.ItemId ?? null);
  if (typeof setScanInfo === 'function') {
    setScanInfo({ code: String(cartonCode), message: `Krabice připravena. Obsah: ${Number(qty) || 0} ks` });
  }
}

export default function useOrderScanRouter(ctx) {
  const {
    completeMode,
    orderNumber,                 // (volitelně v ctx)
    getCurrentCompletionItem,
    findItemByCartonCode,
    ensureIssue,
    eanMapRef,
    controlMode,
    controlCounts,
    packageCounts,
    updateControlCount,
    updatePackageCount,
    setScanInfo,
    setScannedItem,
    successAudio,
    errorAudio,

    pickMode,
    setPickMode,
    pendingCarton,
    setPendingCarton,
    getRemainingForItem,
    // setAdjustCtx  // pokud předáš, předvyplní qty v modalu
  } = ctx;

  const onScan = async (code) => {
    const raw = String(code ?? '').trim();
    const qr  = parseQrPayload(raw);
    const carton = qr?.carton_code || (decodeCartonCode(raw)?.cartonCode) || null;
    const isPureEan = /^\d{12,14}$/.test(raw);

    // ======= MIMO KOMPLETACI => přímý režim hned po skenu krabice =======
    if (!completeMode) {
      if (isPureEan) {
        logScanEvent({ raw, type: 'ean', outcome: 'rejected' });
        playSound(errorAudio);
        return;
      }
      if (carton) {
        logScanEvent({ raw, type: 'carton', carton_code: carton, outcome: 'accepted' });
        try { await (ensureIssue && ensureIssue()); } catch {}

        const it = findItemByCartonCode && findItemByCartonCode(carton);
        if (!it) {
          playSound(errorAudio);
          setScanInfo && setScanInfo({ code: String(carton), message: 'Krabice nenavazuje na žádnou položku objednávky.' });
          setScannedItem && setScannedItem(null);
          return;
        }

        // načti qty (resolve) — 200 => data, 204 => qty=0
        let qty = 0;
        try {
          const ord = ctx?.orderNumber || getOrderNumberFromLocation();
          if (ord) {
            const r = await resolveCarton(ord, String(carton));
            qty = Number(r?.qty || 0);
          }
        } catch { qty = 0; }

        await openDirect(ctx, it, carton, qty);
        playSound && playSound(successAudio);
        setScannedItem && setScannedItem(it);
        return;
      }

      // fallback EAN mimo kompletaci
      const hit = (eanMapRef && eanMapRef.current && eanMapRef.current.get(raw)) ||
                  (eanMapRef && eanMapRef.current && eanMapRef.current.get('0' + raw));
      if (hit) {
        const { item, qty } = hit;
        const prev = controlMode ? (controlCounts[item.ItemId] || 0) : (packageCounts[item.ItemId] || 0);
        const next = prev + (Number(qty) || 0);
        const slotName = item.slot_first || null;

        if (controlMode) {
          await (updateControlCount && updateControlCount(item.ItemId, next, Number(item.SalesQty) || 0, slotName));
        } else {
          await (updatePackageCount && updatePackageCount(item.ItemId, next, Number(item.SalesQty) || 0, slotName));
        }
        setScanInfo && setScanInfo({ code: raw, message: `+${Number(qty) || 0} ks (celkem ${next}/${Number(item.SalesQty) || 0})` });
        setScannedItem && setScannedItem(item);
        logScanEvent({ raw, type: 'ean', outcome: 'accepted' });
      } else {
        playSound(errorAudio);
        setScanInfo && setScanInfo({ code: raw, message: 'Kód nerozpoznán (QR ani EAN)' });
        setScannedItem && setScannedItem(null);
        logScanEvent({ raw, type: 'unknown', outcome: 'rejected' });
      }
      return;
    }

    // ======= V KOMPLETACI (auto/partial) – beze změn krom drobných zodolnění =======
    const current = getCurrentCompletionItem && getCurrentCompletionItem();
    if (!current) {
      playSound(errorAudio);
      setScanInfo && setScanInfo({ code: raw, message: 'Kompletace otevřená, ale žádná položka není vybrána.' });
      setScannedItem && setScannedItem(null);
      return;
    }

    if (pickMode === 'awaitingCarton' || pickMode === 'partialForCarton') {
      if (isPureEan) {
        logScanEvent({ raw, type: 'ean', outcome: 'rejected' });
        playSound(errorAudio);
        return;
      }
      if (carton) {
        const scanned = findItemByCartonCode && findItemByCartonCode(carton);
        if (!scanned || scanned.ItemId !== current.ItemId) {
          playSound(errorAudio);
          setScanInfo && setScanInfo({ code: String(carton), message: 'Krabice patří k jinému produktu.' });
          setScannedItem && setScannedItem(null);
          return;
        }
        setPendingCarton && setPendingCarton(String(carton));
        setPickMode && setPickMode('partialForCarton');
        playSound(successAudio);
        setScanInfo && setScanInfo({ code: String(carton), message: 'Krabice připravena. Naskenuj sáček/kusy.' });
        setScannedItem && setScannedItem(current);
        logScanEvent({ raw, type: 'carton', carton_code: carton, outcome: 'accepted' });
        return;
      }

      const remaining = getRemainingForItem ? getRemainingForItem(current) : 0;
      const hit = (eanMapRef && eanMapRef.current && eanMapRef.current.get(raw)) ||
                  (eanMapRef && eanMapRef.current && eanMapRef.current.get('0' + raw));
      if (!hit) {
        playSound(errorAudio);
        setScanInfo && setScanInfo({ code: raw, message: 'Očekávám sáček/kusy pro aktuální krabici.' });
        setScannedItem && setScannedItem(null);
        return;
      }
      if (hit.item.ItemId !== current.ItemId) {
        playSound(errorAudio);
        setScanInfo && setScanInfo({ code: raw, message: 'Kód nepatří k aktuálně zobrazenému produktu.' });
        setScannedItem && setScannedItem(null);
        return;
      }

      const delta = Math.min(remaining, Number(hit.qty) || 0);
      if (delta <= 0) {
        playSound(errorAudio);
        setScanInfo && setScanInfo({ code: raw, message: 'Nelze přičíst (0 ks nebo nic nezbývá).' });
        setScannedItem && setScannedItem(null);
        return;
      }

      const prev = controlMode ? (controlCounts[current.ItemId] || 0) : (packageCounts[current.ItemId] || 0);
      const next = prev + delta;
      const slotName = current.slot_first || null;
      const extra = pendingCarton ? { cartonCode: String(pendingCarton) } : {};

      if (controlMode) {
        await (updateControlCount && updateControlCount(current.ItemId, next, Number(current.SalesQty) || 0, slotName, extra));
      } else {
        await (updatePackageCount && updatePackageCount(current.ItemId, next, Number(current.SalesQty) || 0, slotName, extra));
      }

      setScanInfo && setScanInfo({ code: raw, message: `+${delta} ks (z krabice ${pendingCarton || '—'})` });
      setScannedItem && setScannedItem(current);
      logScanEvent({ raw, type: 'pouch/base', carton_code: pendingCarton || undefined, outcome: 'accepted' });
      return;
    }

    // AUTO flow – krabice / EAN
    if (isPureEan) {
      logScanEvent({ raw, type: 'ean', outcome: 'rejected' });
      playSound(errorAudio);
      return;
    }
    if (carton) {
      const scanned = findItemByCartonCode && findItemByCartonCode(carton);
      if (!scanned || scanned.ItemId !== current.ItemId) {
        playSound(errorAudio);
        setScanInfo && setScanInfo({ code: String(carton), message: 'Krabice patří k jinému produktu.' });
        setScannedItem && setScannedItem(null);
        return;
      }

      const boxQty = Number(current.QTY_Box) > 0 ? Number(current.QTY_Box) : 1;
      const remaining = getRemainingForItem ? getRemainingForItem(current) : 0;

      if (boxQty > remaining) {
        setPendingCarton && setPendingCarton(String(carton));
        setPickMode && setPickMode('partialForCarton');
        playSound(successAudio);
        setScanInfo && setScanInfo({ code: String(carton), message: 'Krabice připravena. Naskenuj sáček/kusy.' });
        setScannedItem && setScannedItem(current);
        logScanEvent({ raw, type: 'carton', carton_code: carton, outcome: 'accepted' });
        return;
      }

      const prev = controlMode ? (controlCounts[current.ItemId] || 0) : (packageCounts[current.ItemId] || 0);
      const next = prev + boxQty;
      const slotName = current.slot_first || null;
      const opts = { cartonCode: String(carton) };

      if (controlMode) {
        await (updateControlCount && updateControlCount(current.ItemId, next, Number(current.SalesQty) || 0, slotName, opts));
      } else {
        await (updatePackageCount && updatePackageCount(current.ItemId, next, Number(current.SalesQty) || 0, slotName, opts));
      }

      setScanInfo && setScanInfo({ code: String(carton), message: `+${boxQty} ks (celkem ${next}/${Number(current.SalesQty) || 0})` });
      setScannedItem && setScannedItem(current);
      logScanEvent({ raw, type: 'carton', carton_code: carton, outcome: 'accepted' });
      return;
    }

    const hit = (eanMapRef && eanMapRef.current && eanMapRef.current.get(raw)) ||
                (eanMapRef && eanMapRef.current && eanMapRef.current.get('0' + raw));
    if (!hit || hit.item.ItemId !== current.ItemId) {
      playSound(errorAudio);
      setScanInfo && setScanInfo({ code: raw, message: 'Sken nepatří k aktuálně zobrazenému produktu.' });
      setScannedItem && setScannedItem(null);
      logScanEvent({ raw, type: 'ean', outcome: 'rejected' });
      return;
    }

    const { item, qty } = hit;
    const remaining2 = getRemainingForItem ? getRemainingForItem(item) : 0;
    const prev2 = controlMode ? (controlCounts[item.ItemId] || 0) : (packageCounts[item.ItemId] || 0);
    const delta2 = Math.min(remaining2, Number(qty) || 0);
    const next2 = prev2 + delta2;
    const slotName2 = item.slot_first || null;

    if (delta2 > 0) {
      if (controlMode) {
        await (updateControlCount && updateControlCount(item.ItemId, next2, Number(item.SalesQty) || 0, slotName2));
      } else {
        await (updatePackageCount && updatePackageCount(item.ItemId, next2, Number(item.SalesQty) || 0, slotName2));
      }
    }

    setScanInfo && setScanInfo({ code: raw, message: `+${delta2} ks (celkem ${next2}/${Number(item.SalesQty) || 0})` });
    setScannedItem && setScannedItem(item);
    logScanEvent({ raw, type: 'ean', outcome: delta2 > 0 ? 'accepted' : 'noop' });
  };

  return onScan;
}
