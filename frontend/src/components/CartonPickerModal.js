import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';

export default function CartonPickerModal({ open, onClose, onConfirm }) {
  const [code, setCode] = useState('');

  const handleConfirm = () => {
    if (code && onConfirm) onConfirm(code.trim());
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Manuální výběr krabice</DialogTitle>
      <DialogContent dividers>
        <TextField
          label="Číslo krabice"
          fullWidth
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="např. CARTON-ABC123"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Zrušit</Button>
        <Button variant="contained" onClick={handleConfirm}>Potvrdit</Button>
      </DialogActions>
    </Dialog>
  );
}
