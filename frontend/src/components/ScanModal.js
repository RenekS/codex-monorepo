import React from 'react';
import { Dialog, DialogTitle, DialogContent, Button, Box, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export default function ScanModal({ open, onClose, scanInfo, scannedItem }) {
  const code = scanInfo?.code || '';
  const msg  = scanInfo?.message || '';

  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Skener
        <Button onClick={onClose}><CloseIcon /></Button>
      </DialogTitle>
      <DialogContent>
        {scannedItem ? (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6">{scannedItem.ItemName}</Typography>
            <Typography sx={{ mt: 1 }}>Kód: <strong>{code}</strong></Typography>
            {msg && <Typography sx={{ mt: 1 }}>{msg}</Typography>}
          </Box>
        ) : (
          <Box sx={{ p: 2 }}>
            <Typography>Naskenováno: <strong>{code}</strong></Typography>
            {msg && <Typography sx={{ mt: 1 }}>{msg}</Typography>}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
