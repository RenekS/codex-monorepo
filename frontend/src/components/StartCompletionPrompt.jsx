import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography
} from '@mui/material';

export default function StartCompletionPrompt({
  open,
  onCancel,
  onStart,
  productLabel = '',
  issueDocNo = null,
  cartonCode = null
}) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Začít kompletaci?</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          {cartonCode ? <>Zachycen QR krabice <strong>{cartonCode}</strong>. </> : null}
          Chceš začít kompletaci {productLabel ? <>produktu <strong>{productLabel}</strong></> : 'tohoto produktu'}
          {issueDocNo ? <> do výdejky <strong>{issueDocNo}</strong></> : null}?
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Ne</Button>
        <Button variant="contained" onClick={onStart}>Ano, začít</Button>
      </DialogActions>
    </Dialog>
  );
}
