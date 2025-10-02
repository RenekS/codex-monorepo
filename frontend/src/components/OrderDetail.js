// src/components/OrderDetail.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';

import successSoundFile from '../sounds/success-sound.mp3';
import errorSoundFile from '../sounds/error-sound.mp3';
import useBarcodeScanner from '../hooks/useBarcodeScanner';

import { s, normSlots } from '../utils/qr';
import { playSound } from '../utils/sound';
import useIssue from '../hooks/useIssue';
import useOrderScanRouter from '../hooks/useOrderScanRouter';
import {
  getPickedOrders,
  getOrderDetail as apiGetOrderDetail,
  postPicked,
  getPickedItems,
  deletePickedItems
} from '../services/wmsApi';

import OrderSummary from './OrderSummary';
import OrderTable from './OrderTable';
import NumberPad from './NumberPad';
import CompleteModal from './CompleteModal';
// ScanModal odstraněn
import PickedItemsModal from './PickedItemsModal';
import StartCompletionPrompt from './StartCompletionPrompt';
import {
  Box as MBox,
  Button,
  Typography,
  Switch,
  FormControlLabel,
  Paper,
  CircularProgress as MCircularProgress
} from '@mui/material';
import {
  Fullscreen as FullscreenIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

export default function OrderDetail() {
  const { orderNumber } = useParams();
  const navigate = useNavigate();

  const [controlMode, setControlMode] = useState(false);
  const [orderDetail, setOrderDetail] = useState(null);
  const [packageCounts, setPackageCounts] = useState({});
  const [controlCounts, setControlCounts] = useState({});
  const [editingPackage, setEditingPackage] = useState(null);
  const [editingControl, setEditingControl] = useState(null);
  const [pickedOrders, setPickedOrders] = useState([]);
  const [currentOrderIndex, setCurrentOrderIndex] = useState(-1);

  // zůstává kvůli hooku, i když UI modal neukazuje
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanInfo, setScanInfo] = useState({ code: '', message: '' });
  const [scannedItem, setScannedItem] = useState(null);

  const [completeMode, setCompleteMode] = useState(false);
  const [completeIndex, setCompleteIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  // řízený režim kompletace
  const [pickMode, setPickMode] = useState('auto'); // 'auto' | 'awaitingCarton' | 'partialForCarton'
  const [pendingCarton, setPendingCarton] = useState(null); // string | null

  // ✨ fokus na aktuálně kompletovanou položku (lock)
  const [focusedItemId, setFocusedItemId] = useState(null);

  // === výdejka (issue) ===
  const { issueId, issueDocNo, ensureIssue } = useIssue(orderNumber);

  // audio refs
  const successAudio = useRef(new Audio(successSoundFile));
  const errorAudio = useRef(new Audio(errorSoundFile));
  const eanMapRef = useRef(new Map());

  // mapy pro rychlý přístup
  const productKeyByItemIdRef = useRef(new Map());
  const itemByIdRef = useRef(new Map());

  // modaly pro odebrání a start kompletace
  const [pickedModalOpen, setPickedModalOpen] = useState(false);
  const [pickedModalLoading, setPickedModalLoading] = useState(false);
  const [pickedModalItems, setPickedModalItems] = useState([]);
  const [pickedModalSelected, setPickedModalSelected] = useState(new Set());
  const [pickedModalForItemId, setPickedModalForItemId] = useState(null);

  const [startPromptOpen, setStartPromptOpen] = useState(false);
  const [startPromptCtx, setStartPromptCtx] = useState({ itemId: null, productLabel: '', cartonCode: null });

  const goFullScreen = () => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await getPickedOrders();
        setPickedOrders(data);
        setCurrentOrderIndex(data.findIndex(o => String(o.Order_Number) === orderNumber));
      } catch {
        console.warn('Nelze načíst picked orders');
      }
    })();
  }, [orderNumber]);

  const fetchOrderDetail = async () => {
    setLoading(true);
    try {
      const data = await apiGetOrderDetail(orderNumber);
      const itemsRaw = Array.isArray(data.items) ? data.items : [];

      const items = itemsRaw.map(it => {
        const slots = normSlots(it);
        const slot_first = slots[0]?.slot_name || '';

        return {
          ...it,
          slot_names: slots,
          slots,
          slot_first,
          ItemName_str: s(it.ItemName),
          Product_Ean_str: s(it.EAN_Base || it.Product_Ean || it.BarCode),
          WMSLocationId_str: s(it.WMSLocationId)
        };
      });

      setOrderDetail({ orderNumber: data.orderNumber, Items: items });

      // init counts
      const init = {}, ctrlInit = {};
      items.forEach(it => {
        init[it.ItemId] = it.Product_Picked ?? 0;
        ctrlInit[it.ItemId] = it.Product_Picked_Check ?? 0;
      });
      setPackageCounts(init);
      setControlCounts(ctrlInit);

      // build EAN map
      const map = new Map();
      items.forEach(it => {
        if (it.EAN_Base)  map.set(it.EAN_Base,  { item: it, qty: 1 });
        if (it.EAN_Pouch) map.set(it.EAN_Pouch, { item: it, qty: Number(it.QTY_Pouch) || 0 });
        if (it.EAN_Box)   map.set(it.EAN_Box,   { item: it, qty: Number(it.QTY_Box) || 0 });
        if (it.BarCode)   map.set(it.BarCode,   { item: it, qty: 1 });
      });
      eanMapRef.current = map;

      // mapy pro rychlý přístup
      productKeyByItemIdRef.current = new Map();
      itemByIdRef.current = new Map();
      items.forEach(it => {
        const key = s(it.ItsItemName2) || s(it.Product_Id) || s(it.ItemId);
        productKeyByItemIdRef.current.set(it.ItemId, key);
        itemByIdRef.current.set(it.ItemId, it);
      });

      // reset režimu při načtení nové objednávky
      setPickMode('auto');
      setPendingCarton(null);
    } catch (e) {
      console.warn('Nelze načíst order detail', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrderDetail(); }, [orderNumber]);

  const isCurrentPicked = pickedOrders.some(o => String(o.Order_Number) === orderNumber);

  // --- odvozená data ---
  const items = orderDetail?.Items ?? [];

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) =>
      (a.slot_first || '').localeCompare(b.slot_first || '')
    );
  }, [items]);

  const incompleteItems = useMemo(() => {
    return sortedItems.filter(it =>
      (packageCounts[it.ItemId] || 0) !== it.SalesQty
    );
  }, [sortedItems, packageCounts]);

  // pojistka indexu, když se seznam změní nebo se modal otevře
  useEffect(() => {
    setCompleteIndex(i =>
      Math.min(Math.max(i, 0), Math.max(0, incompleteItems.length - 1))
    );
  }, [incompleteItems.length, completeMode]);

  // helpery
  const getCurrentCompletionItem = () => {
    if (completeMode) {
      if (incompleteItems.length > 0 && incompleteItems[completeIndex]) return incompleteItems[completeIndex];
      if (sortedItems.length > 0 && sortedItems[completeIndex]) return sortedItems[completeIndex];
    }
    return null;
  };

  const findItemByCartonCode = (code) => {
    if (!code) return null;
    const parts = String(code).split('-');
    const maybeCode = parts.length >= 2 ? parts[1] : null; // ItsItemName2 bývá druhá část
    if (maybeCode) {
      const hit = items.find(it => s(it.ItsItemName2) === s(maybeCode));
      if (hit) return hit;
    }
    // fallbacky
    const hit2 = items.find(it => code.includes(s(it.ItemId)) || code.includes(s(it.Product_Id)));
    return hit2 || null;
  };

  const buildPostPayload = (itemId, pickedVal, slotName, extra = {}) => {
    const rec = itemByIdRef.current.get(itemId);
    const product_code = rec ? (s(rec.ItsItemName2) || s(rec.Product_Id) || s(rec.ItemId)) : String(itemId);
    const item_id = rec ? (s(rec.Product_Id) || s(rec.ItemId)) : String(itemId);
    return {
      product_code,
      item_id,
      pickedQty: pickedVal,
      slotName,
      issueId,
      cartonCode: extra.cartonCode || null,
    };
  };

  // === UPRAVA: explicitní 'operationType' + ledger pro kontrolu ===
  const updatePackageCount = async (itemId, newCount, maxQty, slotName = null, opts = {}) => {
    setPackageCounts(prev => ({ ...prev, [itemId]: newCount }));
    playSound(newCount > maxQty ? errorAudio : successAudio);
    try {
      const payload = buildPostPayload(itemId, newCount, slotName, opts);
      payload.operationType = 'pick'; // pro čitelnost, backend má default
      await postPicked(orderNumber, payload);
    } catch (err) {
      console.error('Chyba při ukládání pick count:', err);
    }
  };

  const updateControlCount = async (itemId, newCount, maxQty, slotName = null, opts = {}) => {
    const prevCtrl = controlCounts[itemId] || 0;
    const deltaCtrl = newCount - prevCtrl;

    setControlCounts(prev => ({ ...prev, [itemId]: newCount }));
    playSound(newCount > maxQty ? errorAudio : successAudio);

    try {
      // 1) absolutní stav do Orders_raw (jako dosud)
      const payload = buildPostPayload(itemId, packageCounts[itemId], slotName, opts);
      payload.controlQty = newCount;
      payload.operationType = 'control';
      await postPicked(orderNumber, payload);

      // 2) ledger delta do WH_IssueItems (operation_type='control', backend si případný overpick určí sám)
      if (deltaCtrl !== 0 && issueId) {
        const productId = productKeyByItemIdRef.current.get(itemId) || String(itemId);
        await fetch(`/wms/issues/${issueId}/line`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId,
            deltaUnits: deltaCtrl,                 // může být i záporné (oprava)
            slotName: slotName || null,
            cartonCode: opts.cartonCode || null,
            operationType: 'control',
          }),
        }).catch(e => console.error('Ledger control insert error:', e));
      }
    } catch (err) {
      console.error('Chyba při ukládání kontroly:', err);
    }
  };

  // NumberPad helpers (ponecháme pro hlavní tabulku)
  const handleOpenPad = id =>
    controlMode ? setEditingControl(id) : setEditingPackage(id);

  const handlePadSubmit = n => {
    if (controlMode) {
      const it = items.find(i => i.ItemId === editingControl);
      updateControlCount(editingControl, n, it?.SalesQty ?? n, it?.slot_first || null);
      setEditingControl(null);
    } else {
      const it = items.find(i => i.ItemId === editingPackage);
      updatePackageCount(editingPackage, n, it?.SalesQty ?? n, it?.slot_first || null);
      setEditingPackage(null);
    }
  };
  const handlePadCancel = () => {
    setEditingPackage(null);
    setEditingControl(null);
  };
  const handleDoubleClick = (id, maxQty) =>
    controlMode
      ? updateControlCount(id, (controlCounts[id] || 0) === maxQty ? 0 : maxQty, maxQty)
      : updatePackageCount(id, (packageCounts[id] || 0) === maxQty ? 0 : maxQty, maxQty);

  // odebrání naskenovaných položek (existující flow)
  const openRemovePickedModal = async (itemId) => {
    try {
      setPickedModalLoading(true);
      setPickedModalSelected(new Set());
      setPickedModalForItemId(itemId);
      setPickedModalOpen(true);

      const data = await getPickedItems(orderNumber, itemId);
      setPickedModalItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Načtení naskenovaných položek selhalo', e);
      setPickedModalItems([]);
    } finally {
      setPickedModalLoading(false);
    }
  };

  const confirmRemovePicked = async () => {
    const selectedIds = Array.from(pickedModalSelected);
    if (!selectedIds.length || !pickedModalForItemId) {
      setPickedModalOpen(false);
      return;
    }
    try {
      setPickedModalLoading(true);
      await deletePickedItems(orderNumber, pickedModalForItemId, selectedIds);
      await fetchOrderDetail();
      setPickedModalOpen(false);
    } catch (e) {
      console.error('Odebrání naskenovaných položek selhalo', e);
    } finally {
      setPickedModalLoading(false);
    }
  };

  const openCompletionForItem = async (itemId) => {
    try { await ensureIssue(); } catch {}
    const idx = incompleteItems.findIndex(it => it.ItemId === itemId);
    const nextIdx = idx >= 0 ? idx : sortedItems.findIndex(it => it.ItemId === itemId);
    setCompleteIndex(nextIdx >= 0 ? nextIdx : 0);
    setCompleteMode(true);
    setPickMode('auto');
    setPendingCarton(null);
    // ✨ zamknout fokus na tu položku
    const it = (idx >= 0 ? incompleteItems[nextIdx] : sortedItems[nextIdx]) || null;
    setFocusedItemId(it?.ItemId ?? itemId);
  };

  // navigace mezi objednávkami
  const goPrev = () => {
    if (isCurrentPicked && currentOrderIndex > 0) {
      navigate(`/order/${pickedOrders[currentOrderIndex - 1].Order_Number}`);
    } else {
      playSound(errorAudio);
    }
  };
  const goNext = () => {
    if (isCurrentPicked && currentOrderIndex < pickedOrders.length - 1) {
      navigate(`/order/${pickedOrders[currentOrderIndex + 1].Order_Number}`);
    } else {
      playSound(errorAudio);
    }
  };

  // kliky v tabulce
  const onMinusClick = (item) => {
    if (!controlMode) openRemovePickedModal(item.ItemId);
  };
  const onPlusClick = (item) => {
    if (!controlMode) openCompletionForItem(item.ItemId);
  };

  const onStartComplete = async () => {
    try {
      await ensureIssue();
      setCompleteIndex(0);
      setCompleteMode(true);
      setPickMode('auto');
      setPendingCarton(null);
      // ✨ fokus na první nekompletní (pokud existuje)
      const first = incompleteItems[0];
      setFocusedItemId(first?.ItemId ?? null);
    } catch (e) {
      playSound(errorAudio);
      alert('Nepodařilo se založit výdejku.');
    }
  };

  // kolik zbývá pro aktuální položku
  const getRemainingForItem = (item) => {
    if (!item) return 0;
    const current = controlMode ? (controlCounts[item.ItemId] || 0) : (packageCounts[item.ItemId] || 0);
    const target = Number(item.SalesQty) || 0;
    return Math.max(0, target - current);
  };

  // skener
  const onScan = useOrderScanRouter({
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
    setScanModalOpen,
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
  });
  useBarcodeScanner(onScan);

  // ✨ LOCK: drž aktuální položku, dokud není kompletní
  useEffect(() => {
    if (!completeMode) return;

    if (focusedItemId) {
      const idx = incompleteItems.findIndex(it => it.ItemId === focusedItemId);

      if (idx >= 0) {
        // položka ještě není kompletní → drž na ní index
        if (idx !== completeIndex) setCompleteIndex(idx);
      } else {
        // položka se právě dokončila → posuň na další dostupnou
        const nextIdx = Math.min(completeIndex, Math.max(0, incompleteItems.length - 1));
        setCompleteIndex(nextIdx);
        setFocusedItemId(incompleteItems[nextIdx]?.ItemId ?? null);
      }
    } else {
      // fallback: když není fokus, zamkni na aktuální index
      const cur = incompleteItems[completeIndex];
      if (cur) setFocusedItemId(cur.ItemId);
    }
  }, [incompleteItems, completeMode, focusedItemId, completeIndex]);

  // wrapper na změnu indexu z modalu → udržuje lock
  const setCompleteIndexLocked = (updater) => {
    setCompleteIndex(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const nextItem = incompleteItems[next];
      if (nextItem) setFocusedItemId(nextItem.ItemId);
      return next;
    });
  };

  if (!orderDetail) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress />
      </Box>
    );
  }

  const isPicked = isCurrentPicked;
  return (
    <>
      <Box sx={{ p: 2 }}>
        {/* toolbar */}
        <MBox sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControlLabel
            control={
              <Switch
                checked={controlMode}
                onChange={e => setControlMode(e.target.checked)}
                color="primary"
              />
            }
            label="Kontrola"
            sx={{ ml: 0 }}
          />
          <Button onClick={goPrev} disabled={!isPicked}>Předchozí</Button>
          <Button onClick={goNext} disabled={!isPicked}>Další</Button>
          <Button
            variant="contained"
            onClick={onStartComplete}
            disabled={incompleteItems.length === 0}
          >
            Kompletovat
          </Button>
          {issueDocNo && (
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Výdejka: {issueDocNo}
            </Typography>
          )}
          <Button onClick={goFullScreen}><FullscreenIcon /></Button>
          <Button onClick={fetchOrderDetail} title="Aktualizovat" disabled={loading}>
            <RefreshIcon />
            {loading && <MCircularProgress size={18} sx={{ ml: 1 }} />}
          </Button>
        </MBox>

        <Typography variant="h4" sx={{ mb: 2 }}>Objednávka č. {orderDetail.orderNumber}</Typography>

        <OrderSummary
          orderDetail={orderDetail}
          packageCounts={packageCounts}
          controlCounts={controlCounts}
          controlMode={controlMode}
          orderNumber={orderDetail.orderNumber}
        />

        <Paper>
          <OrderTable
            items={items}
            packageCounts={packageCounts}
            controlCounts={controlCounts}
            controlMode={controlMode}
            updatePackageCount={updatePackageCount}
            updateControlCount={updateControlCount}
            handleOpenPad={handleOpenPad}
            handleDoubleClick={handleDoubleClick}
            onMinusClick={onMinusClick}
            onPlusClick={onPlusClick}
          />
        </Paper>

        {(editingPackage || editingControl) && (
          <NumberPad
            value={controlMode
              ? controlCounts[editingControl] || 0
              : packageCounts[editingPackage] || 0}
            onSubmit={handlePadSubmit}
            onSubmitAddition={n => handlePadSubmit(
              (controlMode
                ? (controlCounts[editingControl] || 0)
                : (packageCounts[editingPackage] || 0)
              ) + n
            )}
            onCancel={handlePadCancel}
          />
        )}
      </Box>

      {/* ScanModal odstraněn */}

      <CompleteModal
        open={completeMode}
        onClose={() => setCompleteMode(false)}
        incompleteItems={incompleteItems}
        completeIndex={completeIndex}
        setCompleteIndex={setCompleteIndexLocked} 
        controlMode={controlMode}
        packageCounts={packageCounts}
        controlCounts={controlCounts}
        updatePackageCount={updatePackageCount}
        updateControlCount={updateControlCount}

        // nové props
        pickMode={pickMode}
        pendingCarton={pendingCarton}
        remainingForItem={getRemainingForItem}
        onManualPieces={async (itemId, pcs) => {
          const it = items.find(i => i.ItemId === itemId);
          if (!it) return;
          const prev = controlMode
            ? (controlCounts[itemId] || 0)
            : (packageCounts[itemId] || 0);
          const next = Math.max(0, Math.min(prev + pcs, Number(it.SalesQty) || prev + pcs));
          const slotName = it.slot_first || null;
          const extra = pendingCarton ? { cartonCode: String(pendingCarton) } : {};
          if (controlMode) await updateControlCount(itemId, next, it.SalesQty, slotName, extra);
          else await updatePackageCount(itemId, next, it.SalesQty, slotName, extra);
        }}
        onRequestRemove={openRemovePickedModal}
      />

      <PickedItemsModal
        open={pickedModalOpen}
        onClose={() => setPickedModalOpen(false)}
        items={pickedModalItems}
        selectedIds={pickedModalSelected}
        setSelectedIds={setPickedModalSelected}
        onConfirm={confirmRemovePicked}
        productLabel={(() => {
          const it = (orderDetail?.Items || []).find(x => x.ItemId === pickedModalForItemId);
          return it ? (s(it.ItsItemName2) || (it.ItemName_str) || s(it.ItemId)) : '';
        })()}
        loading={pickedModalLoading}
      />

      <StartCompletionPrompt
        open={startPromptOpen}
        onCancel={() => setStartPromptOpen(false)}
        onStart={async () => {
          setStartPromptOpen(false);
          try { await ensureIssue(); } catch {}
          if (startPromptCtx.itemId) {
            await openCompletionForItem(startPromptCtx.itemId);
          } else {
            setCompleteMode(true);
            setPickMode('auto');
            setPendingCarton(null);
            // ✨ fokus na aktuální položku v seznamu
            const cur = incompleteItems[completeIndex];
            setFocusedItemId(cur?.ItemId ?? incompleteItems[0]?.ItemId ?? null);
          }
        }}
        productLabel={startPromptCtx.productLabel}
        issueDocNo={issueDocNo}
        cartonCode={startPromptCtx.cartonCode}
      />
    </>
  );
}
