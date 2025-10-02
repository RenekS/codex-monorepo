import { useCallback } from 'react';
import { postPicked } from '../services/wmsApi';
import { playSound } from '../utils/sound';

/**
 * Hook pro kontrolní režim (scany a změny počtů).
 * - odděluje logiku od OrderDetail.jsx
 */
export default function useControl({
  orderNumber,
  packageCounts,
  controlCounts,
  successAudio,
  errorAudio,
  setControlCounts,
}) {
  // update kontrolního počtu
  const updateControlCount = useCallback(async (itemId, newCount, maxQty, slotName = null, opts = {}) => {
    setControlCounts(prev => ({ ...prev, [itemId]: newCount }));
    playSound(newCount > maxQty ? errorAudio : successAudio);

    try {
      const payload = {
        product_code: opts.productCode || String(itemId),
        item_id: String(itemId),
        pickedQty: packageCounts[itemId] ?? 0, // stav picku
        controlQty: newCount,
        slotName,
        issueId: opts.issueId || null,
        cartonCode: opts.cartonCode || null,
        operationType: 'control',
      };
      await postPicked(orderNumber, payload);
    } catch (err) {
      console.error('Chyba při ukládání kontroly:', err);
    }
  }, [orderNumber, packageCounts, setControlCounts, successAudio, errorAudio]);

  return { updateControlCount };
}
