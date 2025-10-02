// src/hooks/useOrderScanRouter.js
import { useRef } from 'react';
import { parseQrPayload, s } from '../utils/qr';
import { playSound } from '../utils/sound';

/**
 * Zapouzdřuje kompletní handleScan logiku pro OrderDetail.
 * Režimy:
 * - auto: standard (plné krabice/sáčky/kusy)
 * - awaitingCarton: čekám na QR krabice pro dílčí výdej
 * - partialForCarton: krabice zvolena, přijímám sáčky/kusy (nebo manuální kusy) z této krabice
 */
export default function useOrderScanRouter(ctx) {
  const {
    completeMode,
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
    // setScanModalOpen,  // modal už nepoužíváme
    successAudio,
    errorAudio,
    setStartPromptCtx,
    setStartPromptOpen,

    // nové:
    pickMode,
    setPickMode,
    pendingCarton,
    setPendingCarton,
    getRemainingForItem,
  } = ctx;

  const guardRef = useRef({}); // volitelný anti-dvojklik, zatím nevyužito

  const onScan = async (code) => {
    const qr = parseQrPayload(code);

    // ======= KOMPLETACE =======
    if (completeMode) {
      const current = getCurrentCompletionItem();
      if (!current) {
        playSound(errorAudio);
        setScanInfo({ code, message: 'Kompletace otevřená, ale žádná položka není vybrána.' });
        setScannedItem(null);
        return;
      }

      // --- PARTIAL FLOW: čekám na krabici nebo už mám krabici vybranou
      if (pickMode === 'awaitingCarton' || pickMode === 'partialForCarton') {
        // 1) nejdřív QR krabice
        if (qr.carton_code) {
          try { await ensureIssue(); } catch {}
          const scanned = findItemByCartonCode(qr.carton_code);
          if (!scanned || scanned.ItemId !== current.ItemId) {
            playSound(errorAudio);
            setScanInfo({
              code: String(qr.carton_code),
              message: 'Krabice patří k jinému produktu.',
            });
            setScannedItem(null);
            return;
          }
          setPendingCarton(String(qr.carton_code));
          setPickMode('partialForCarton');
          // ✅ tady necháme úspěšné pípnutí – nedošlo k update, je to jen stavová změna
          playSound(successAudio);
          setScanInfo({
            code: String(qr.carton_code),
            message: 'Krabice připravena. Naskenuj sáček (EAN_Pouch) nebo kusy (EAN_Base).',
          });
          setScannedItem(current);
          return;
        }

        // 2) sáček/kusy → přičti jen do zbytku; svážeme s pendingCarton
        const remaining = getRemainingForItem(current);
        const hit = eanMapRef.current.get(code) || eanMapRef.current.get('0' + code);
        if (!hit) {
          playSound(errorAudio);
          setScanInfo({
            code,
            message: 'Kód nerozpoznán (očekávám sáček nebo kusy pro aktuální krabici).',
          });
          setScannedItem(null);
          return;
        }
        if (hit.item.ItemId !== current.ItemId) {
          playSound(errorAudio);
          setScanInfo({ code, message: 'Kód nepatří k aktuálně zobrazenému produktu.' });
          setScannedItem(null);
          return;
        }

        const delta = Math.min(remaining, Number(hit.qty) || 0);
        if (delta <= 0) {
          playSound(errorAudio);
          setScanInfo({ code, message: 'Nelze přičíst (0 ks nebo nic nezbývá).' });
          setScannedItem(null);
          return;
        }

        const prev = controlMode
          ? (controlCounts[current.ItemId] || 0)
          : (packageCounts[current.ItemId] || 0);
        const next = prev + delta;
        const slotName = current.slot_first || null;
        const extra = pendingCarton ? { cartonCode: String(pendingCarton) } : {};

        if (controlMode) {
          await updateControlCount(current.ItemId, next, current.SalesQty, slotName, extra);
        } else {
          await updatePackageCount(current.ItemId, next, current.SalesQty, slotName, extra);
        }

        // ❌ NEPÍPAT znovu – update* už přehrál success/error podle stavu
        setScanInfo({
          code,
          message: `+${delta} ks (z krabice ${pendingCarton || '—'})`,
        });
        setScannedItem(current);
        return;
      }

      // --- AUTO FLOW
      if (qr.carton_code) {
        // QR = KRABICE
        try { await ensureIssue(); } catch {}
        const scanned = findItemByCartonCode(qr.carton_code);
        if (!scanned || scanned.ItemId !== current.ItemId) {
          playSound(errorAudio);
          setScanInfo({
            code: String(qr.carton_code),
            message: 'Krabice patří k jinému produktu.',
          });
          setScannedItem(null);
          return;
        }

        const boxQty = Number(current.QTY_Box) > 0 ? Number(current.QTY_Box) : 1;
        const remaining = getRemainingForItem(current);

        // celá krabice by přesáhla → přepnout do partial režimu
        if (boxQty > remaining) {
          setPendingCarton(String(qr.carton_code));
          setPickMode('partialForCarton');
          // ✅ stavová změna bez update → pípni jednou
          playSound(successAudio);
          setScanInfo({
            code: String(qr.carton_code),
            message: 'Krabice připravena. Naskenuj sáček nebo kusy.',
          });
          setScannedItem(current);
          return;
        }

        // vejde se celá → provedeme update
        const prev = controlMode
          ? (controlCounts[current.ItemId] || 0)
          : (packageCounts[current.ItemId] || 0);
        const next = prev + boxQty;
        const slotName = current.slot_first || null;
        const opts = { cartonCode: String(qr.carton_code) };
        if (controlMode) {
          await updateControlCount(current.ItemId, next, current.SalesQty, slotName, opts);
        } else {
          await updatePackageCount(current.ItemId, next, current.SalesQty, slotName, opts);
        }

        // ❌ žádné druhé pípnutí
        setScanInfo({
          code: String(qr.carton_code),
          message: `+${boxQty} ks (celkem ${next}/${current.SalesQty})`,
        });
        setScannedItem(current);
        return;
      }

      // EAN: sáček/kus v auto režimu
      const hit = eanMapRef.current.get(code) || eanMapRef.current.get('0' + code);
      if (!hit || hit.item.ItemId !== current.ItemId) {
        playSound(errorAudio);
        setScanInfo({ code, message: 'Sken nepatří k aktuálně zobrazenému produktu.' });
        setScannedItem(null);
        return;
      }
      const { item, qty } = hit;
      const remaining2 = getRemainingForItem(item);
      const prev2 = controlMode
        ? (controlCounts[item.ItemId] || 0)
        : (packageCounts[item.ItemId] || 0);
      const delta2 = Math.min(remaining2, qty || 0);
      const next2 = prev2 + delta2;
      const slotName2 = item.slot_first || null;

      if (delta2 > 0) {
        if (controlMode) {
          await updateControlCount(item.ItemId, next2, item.SalesQty, slotName2);
        } else {
          await updatePackageCount(item.ItemId, next2, item.SalesQty, slotName2);
        }
      }

      // ❌ žádné druhé pípnutí
      setScanInfo({ code, message: `+${delta2} ks (celkem ${next2}/${item.SalesQty})` });
      setScannedItem(item);
      return;
    }

    // ======= MIMO KOMPLETACI =======
    // mimo režim kompletace – pokud je to QR krabice, nabídneme start kompletace
    if (qr.carton_code) {
      const it = findItemByCartonCode(qr.carton_code);
      if (it) {
        setStartPromptCtx({
          itemId: it.ItemId,
          productLabel: s(it.ItsItemName2) || s(it.ItemName_str) || s(it.ItemId),
          cartonCode: String(qr.carton_code),
        });
        setStartPromptOpen(true);
        return;
      }
    }

    // fallback – původní EAN flow (mimo kompletaci)
    const hit = eanMapRef.current.get(code) || eanMapRef.current.get('0' + code);
    if (hit) {
      const { item, qty } = hit;
      const prev = controlMode
        ? (controlCounts[item.ItemId] || 0)
        : (packageCounts[item.ItemId] || 0);
      const next = prev + qty;
      const slotName = item.slot_first || null;

      if (controlMode) {
        await updateControlCount(item.ItemId, next, item.SalesQty, slotName);
      } else {
        await updatePackageCount(item.ItemId, next, item.SalesQty, slotName);
      }
      // ❌ žádné druhé pípnutí
      setScanInfo({ code, message: `+${qty} ks (celkem ${next}/${item.SalesQty})` });
      setScannedItem(item);
    } else {
      playSound(errorAudio);
      setScanInfo({ code, message: 'Kód nerozpoznán (QR ani EAN)' });
      setScannedItem(null);
    }
  };

  return onScan;
}
