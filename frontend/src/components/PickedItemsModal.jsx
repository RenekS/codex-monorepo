import React, { useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, List, ListItem, ListItemText, Checkbox, Typography, Divider
} from '@mui/material';

export default function PickedItemsModal({
  open,
  onClose,
  items = [],
  selectedIds = new Set(),
  setSelectedIds = () => {},
  onConfirm,
  productLabel = '',
  loading = false
}) {
  const totalSelected = useMemo(
    () => items.filter(x => selectedIds.has(x.id)).reduce((s, x) => s + Number(x.qty_units || 0), 0),
    [items, selectedIds]
  );

  const toggle = (id) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Odebrat naskenované položky {productLabel ? `– ${productLabel}` : ''}</DialogTitle>
      <DialogContent dividers>
        {items.length === 0 ? (
          <Typography variant="body2" sx={{ opacity: .7 }}>Žádné naskenované krabice/sáčky pro tento produkt.</Typography>
        ) : (
          <>
            <Typography variant="caption" sx={{ opacity: .7, display: 'block', mb: 1 }}>
              Sáčky nemají vlastní šarži – řídí se šarží krabice, ve které jsou.
            </Typography>
            <List dense disablePadding>
              {items.map(row => (
                <ListItem key={row.id} secondaryAction={
                  <Typography variant="caption" sx={{ opacity: .7 }}>
                    {row.created_at ? new Date(row.created_at).toLocaleString() : null}
                  </Typography>
                }>
                  <Checkbox
                    edge="start"
                    checked={selectedIds.has(row.id)}
                    onChange={() => toggle(row.id)}
                    tabIndex={-1}
                  />
                  <ListItemText
                    primary={
                      <>
                        {row.carton_code
                          ? <>Krabice <strong>{row.carton_code}</strong></>
                          : <>Sáček</>
                        } · {Number(row.qty_units || 0)} ks
                      </>
                    }
                    secondary={row.product_id ? `Produkt: ${row.product_id}` : null}
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>
      <Divider />
      <DialogActions>
        <Typography variant="body2" sx={{ flex: 1, ml: 2, opacity: .8 }}>
          Vybráno k odebrání: <strong>{totalSelected}</strong> ks
        </Typography>
        <Button onClick={onClose} disabled={loading}>Zavřít</Button>
        <Button variant="contained" color="error" onClick={onConfirm} disabled={loading || selectedIds.size === 0}>
          Odebrat vybrané
        </Button>
      </DialogActions>
    </Dialog>
  );
}
