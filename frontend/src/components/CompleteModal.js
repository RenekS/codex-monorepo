// src/components/OrderDetail/CompleteModal.js
import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIos from '@mui/icons-material/ArrowBackIos';
import ArrowForwardIos from '@mui/icons-material/ArrowForwardIos';
import QtyBreakdown from './QtyBreakdown';

export default function CompleteModal({
  open, onClose,
  incompleteItems, completeIndex, setCompleteIndex,
  controlMode, packageCounts, controlCounts,
  updatePackageCount, updateControlCount,

  // nové:
  pickMode,           // 'auto' | 'awaitingCarton' | 'partialForCarton'
  pendingCarton,      // string | null
  remainingForItem,   // (item) => number
  onManualPieces,     // (itemId, pcs) => Promise<void>
  onRequestRemove,    // (itemId) => void
}) {
  if (!open) return null;

  const hasItems = Array.isArray(incompleteItems) && incompleteItems.length > 0;
  const safeIndex = Math.min(
    Math.max(completeIndex || 0, 0),
    Math.max(0, (incompleteItems?.length || 1) - 1)
  );
  const it = hasItems ? incompleteItems[safeIndex] : null;

  const currentVal = it
    ? (controlMode ? (controlCounts[it.ItemId] || 0) : (packageCounts[it.ItemId] || 0))
    : 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {hasItems
          ? `Kompletace (${safeIndex + 1}/${incompleteItems.length})`
          : 'Kompletace'}
      </DialogTitle>

      <DialogContent>
        {!hasItems && (
          <Typography align="center" sx={{ py: 2 }}>
            Všechny položky jsou kompletní. 🎉
          </Typography>
        )}

        {hasItems && it && (
          <>
            <Typography variant="h6">{it.ItemName}</Typography>
            <Typography>
              Sloty: {it.slot_names?.map(s => s.slot_name).join(', ') || '-'}
            </Typography>

            <Typography sx={{ mt: 1 }}>
              Objednáno: {it.SalesQty} ks
            </Typography>
            <QtyBreakdown
              qty={it.SalesQty}
              boxSize={it.QTY_Box}
              pouchSize={it.QTY_Pouch}
            />

            {/* Info řádek: ruční úpravy vypnuté, partial flow umožní ruční kusy */}
            <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              {pickMode === 'auto' && (
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Navýšení prováděj skenem (QR/EAN). Ruční úpravy jsou vypnuté.
                </Typography>
              )}
              {pickMode !== 'auto' && (
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Režim: {pickMode === 'awaitingCarton' ? 'čekám na krabici' : 'dílčí výdej z krabice'}
                  {pendingCarton ? ` (${pendingCarton})` : ''}
                  {it ? ` • zbývá: ${remainingForItem(it)} ks` : ''}
                </Typography>
              )}

              <Button
                variant="outlined"
                onClick={() => onRequestRemove && onRequestRemove(it.ItemId)}
                sx={{ ml: { xs: 0, sm: 'auto' } }}
              >
                Odebrat naskenované…
              </Button>

              {pickMode === 'partialForCarton' && it && (
                <Button
                  variant="contained"
                  onClick={async () => {
                    const rem = remainingForItem(it);
                    const n = window.prompt(`Zadat ručně kusy (max ${rem}):`, String(rem));
                    const pcs = Math.max(0, Math.min(Number(n) || 0, rem));
                    if (pcs > 0 && onManualPieces) await onManualPieces(it.ItemId, pcs);
                  }}
                >
                  Zadat kusy ručně…
                </Button>
              )}
            </Box>

            {/* Přehled aktuálního stavu */}
            <Box sx={{ mt: 2 }}>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 'bold', textAlign: 'center' }}
              >
                {controlMode ? 'Zkontrolováno' : 'Naskenováno'}: {currentVal} ks
              </Typography>

              <QtyBreakdown
                qty={currentVal}
                boxSize={it.QTY_Box}
                pouchSize={it.QTY_Pouch}
              />

              {controlMode && (
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    textAlign: 'center',
                    color:
                      ((controlCounts[it.ItemId] || 0) - (packageCounts[it.ItemId] || 0)) === 0
                        ? 'green'
                        : 'red',
                    mt: 0.5
                  }}
                >
                  Rozdíl: {(controlCounts[it.ItemId] || 0) - (packageCounts[it.ItemId] || 0)} ks
                </Typography>
              )}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button startIcon={<CloseIcon />} onClick={onClose}>Zavřít</Button>
        <Box>
          <Button
            startIcon={<ArrowBackIos />}
            onClick={() => setCompleteIndex(i => Math.max(i - 1, 0))}
            disabled={!hasItems || safeIndex === 0}
          >
            Předchozí
          </Button>
          <Button
            endIcon={<ArrowForwardIos />}
            onClick={() =>
              setCompleteIndex(i => Math.min(i + 1, Math.max(0, incompleteItems.length - 1)))
            }
            disabled={!hasItems || safeIndex === Math.max(0, incompleteItems.length - 1)}
          >
            Další
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
