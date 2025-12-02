// src/components/CompleteModal.js
import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { decodeCartonCode } from '../utils/qr';

export default function CompleteModal({
  open,
  onClose,

  // seznam + kurzor
  incompleteItems,
  completeIndex,
  setCompleteIndex,

  // režim
  controlMode,

  // stavy z OrderDetail
  packageCounts,
  controlCounts,

  // akce zápisu
  updatePackageCount,
  updateControlCount,

  // panel po skenu
  pickMode,
  pendingCarton,
  remainingForItem,
  adjustCtx,
  setAdjustCtx,

  // callbacky
  onAfterAdjustConfirm,
  onManualPieces,
  onRequestRemove
}) {
  // HOOKS nahoře (nepodmíněně)
  const isPhoneLandscape = useMediaQuery('(orientation: landscape) and (max-height: 520px)');

  // bezpečný výběr položky
  const list = Array.isArray(incompleteItems) ? incompleteItems : [];
  const safeIndex = Math.min(Math.max(completeIndex || 0, 0), Math.max(0, (list.length || 1) - 1));
  const it = list.length ? list[safeIndex] : null;

  // decode + qty z krabice
  const decCarton = React.useMemo(() => {
    try { return pendingCarton ? decodeCartonCode(String(pendingCarton)) : null; }
    catch { return null; }
  }, [pendingCarton]);

  const cartonQty = Number(adjustCtx?.qty ?? 0);        // obsah krabice (z /resolve)
  const pSize     = Number(it?.QTY_Pouch) || 0;         // ks v jednom sáčku
  const maxQty    = Number(it?.SalesQty) || 0;          // cílové množství položky

  // === KANONICKÝ MODEL: totalPieces ===
  const [totalPieces, setTotalPieces] = React.useState(0);

  // inicializace z qty krabice (ohraničeno na max položky)
  React.useEffect(() => {
    if (!it) return;
    const init = Math.max(0, Math.min(cartonQty, maxQty));
    setTotalPieces(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [it?.ItemId, cartonQty, maxQty]);

  // odvozené hodnoty
  const sacksCount   = pSize > 0 ? Math.floor(totalPieces / pSize) : 0;
  const piecesRema   = pSize > 0 ? (totalPieces % pSize) : totalPieces;

  // informativně: rozklad celé krabice
  const cartonSacks  = pSize > 0 ? Math.floor(cartonQty / pSize) : 0;
  const cartonRema   = pSize > 0 ? (cartonQty % pSize) : cartonQty;

  // zbyvá do cíle (informativně)
  const remaining    = it ? Math.max(0, maxQty - (controlMode ? (controlCounts[it.ItemId] || 0) : (packageCounts[it.ItemId] || 0))) : 0;

  // měniče – vždy pracují s totalPieces a jen odvodí sáčky/kusy
  const addSacks = (delta) => {
    if (pSize <= 0) return;                 // bez pSize nemá smysl
    setTotalPieces(tp => Math.max(0, Math.min(tp + delta * pSize, maxQty)));
  };
  const addPieces = (delta) => {
    setTotalPieces(tp => Math.max(0, Math.min(tp + delta, maxQty)));
  };

  const handleConfirm = async () => {
    if (!it) return;
    const slotName = it.slot_first || null;
    const extra    = pendingCarton ? { cartonCode: String(pendingCarton) } : {};
    const targetTotal = totalPieces;

    if (controlMode) {
      await updateControlCount(it.ItemId, targetTotal, it.SalesQty, slotName, extra);
    } else {
      await updatePackageCount(it.ItemId, targetTotal, it.SalesQty, slotName, extra);
    }
    if (typeof setAdjustCtx === 'function') setAdjustCtx(null);
    if (typeof onAfterAdjustConfirm === 'function') {
      onAfterAdjustConfirm({ advance: targetTotal >= (Number(it.SalesQty) || 0) });
    }
  };

  const handleClose = () => {
    if (typeof onClose === 'function') onClose();
  };

  // až teď případně vypnout render (hooky už proběhly)
  if (!open) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        bgcolor: 'background.paper',
        ...(isPhoneLandscape
          ? {
              width: '100dvw',
              height: '100dvh',
              display: 'grid',
              gridTemplateRows: 'auto auto 1fr auto',
              gap: 1,
              p: 1,
              overflow: 'hidden'
            }
          : {
              width: 'min(980px, 96vw)',
              height: 'min(88vh, 820px)',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              borderRadius: 2,
              boxShadow: 6,
              display: 'grid',
              gridTemplateRows: 'auto auto 1fr auto',
              gap: 2,
              p: 2,
              position: 'fixed'
            })
      }}
    >
      {/* hlavička */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant={isPhoneLandscape ? 'body1' : 'h6'} sx={{ fontWeight: 600 }}>
          {it ? (it.ItemName_str || it.ItemName || it.ItsItemName2 || it.ItemId) : '—'}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={handleClose}>Zavřít</Button>
      </Box>

      {/* info o krabici + rozklad */}
      <Box sx={{ borderRadius: 1, p: isPhoneLandscape ? 1 : 1.5, bgcolor: 'rgba(0,0,0,0.03)' }}>
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          <strong>Krabice:</strong> {decCarton?.cartonCode || (pendingCarton || '—')}
          &nbsp;|&nbsp;<strong>Produkt:</strong> {decCarton?.productCode || (it?.ItsItemName2 || '—')}
          &nbsp;|&nbsp;<strong>Box #</strong> {decCarton?.boxNumberStr || '—'}
        </Typography>
        <Typography variant="body2">
          <strong>Obsah krabice:</strong> {cartonQty} ks
          {pSize > 0 && (
            <>
              &nbsp;= {cartonSacks} sáčků {cartonRema ? `+ ${cartonRema} ks` : ''} &nbsp;|&nbsp;
              <strong>1 sáček:</strong> {pSize} ks
            </>
          )}
        </Typography>
      </Box>

      {/* panel: sáčky / kusy navíc / celkem ks */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: isPhoneLandscape ? '1fr 1fr 1fr' : '1fr 1fr 1fr',
          gap: 1,
          alignItems: 'stretch',
          overflow: 'hidden'
        }}
      >
        {/* sáčky */}
        <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 1, p: isPhoneLandscape ? 1 : 1.5 }}>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
            Sáčky{pSize > 0 ? ` (${pSize} ks / sáček)` : ''}
          </Typography>
          {pSize > 0 ? (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button variant="outlined" size="small" onClick={() => addSacks(-1)}>-1 sáček</Button>
              <Typography variant="h6" sx={{ minWidth: 60, textAlign: 'center' }}>{sacksCount}</Typography>
              <Button variant="outlined" size="small" onClick={() => addSacks(1)}>+1 sáček</Button>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">Sáčky nejsou definované.</Typography>
          )}
        </Box>

        {/* kusy navíc */}
        <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 1, p: isPhoneLandscape ? 1 : 1.5 }}>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
            Kusy navíc
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="outlined" size="small" onClick={() => addPieces(-1)}>-1</Button>
            <Typography variant="h6" sx={{ minWidth: 60, textAlign: 'center' }}>{piecesRema}</Typography>
            <Button variant="outlined" size="small" onClick={() => addPieces(1)}>+1</Button>
          </Box>
        </Box>

        {/* celkem ks (odvozené) */}
        <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 1, p: isPhoneLandscape ? 1 : 1.5 }}>
          <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
            Celkem kusů
          </Typography>
          <Typography variant="h5" sx={{ textAlign: 'center' }}>{totalPieces}</Typography>
          {remaining ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>
              Zbývá do cíle: {remaining} ks
            </Typography>
          ) : null}
        </Box>
      </Box>

      {/* spodní lišta */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mt: isPhoneLandscape ? 0.5 : 1,
          pt: isPhoneLandscape ? 0.5 : 1,
          borderTop: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          K výdeji: {totalPieces} ks
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" onClick={handleClose}>Zavřít</Button>
        <Button variant="contained" color="primary" onClick={handleConfirm}>
          Potvrdit výdej
        </Button>
      </Box>
    </Box>
  );
}
