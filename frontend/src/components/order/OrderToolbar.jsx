// =============================================================
// File: src/components/order/OrderToolbar.jsx
// =============================================================
import React from 'react';
import { Box, Button, Typography, Switch, FormControlLabel, CircularProgress } from '@mui/material';
import { Fullscreen as FullscreenIcon, Refresh as RefreshIcon } from '@mui/icons-material';

export default function OrderToolbar({ controlMode, setControlMode, goPrev, goNext, isCurrentPicked, onStartComplete, issueDocNo, loading, refresh }) {
  const goFullScreen = () => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  };
  return (
    <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
      <FormControlLabel control={<Switch checked={controlMode} onChange={e => setControlMode(e.target.checked)} color="primary" />} label="Kontrola" sx={{ ml: 0 }} />
      <Button onClick={goPrev} disabled={!isCurrentPicked}>Předchozí</Button>
      <Button onClick={goNext} disabled={!isCurrentPicked}>Další</Button>
      <Button variant="contained" onClick={onStartComplete} disabled={false}>Kompletovat</Button>
      {issueDocNo && (<Typography variant="body2" sx={{ opacity: 0.8 }}>Výdejka: {issueDocNo}</Typography>)}
      <Button onClick={goFullScreen}><FullscreenIcon /></Button>
      <Button onClick={refresh} title="Aktualizovat" disabled={loading}><RefreshIcon />{loading && <CircularProgress size={18} sx={{ ml: 1 }} />}</Button>
    </Box>
  );
}
