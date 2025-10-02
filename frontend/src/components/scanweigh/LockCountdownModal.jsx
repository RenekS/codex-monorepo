// src/components/scanweigh/LockCountdownModal.jsx
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Typography,
  Box,
  Button,
} from "@mui/material";

/**
 * Jednoduchý modal, který zobrazuje odpočet do odemknutí skenu.
 * - leftMs: kolik ms zbývá do odemknutí (od FE gate)
 * - totalMs: celkový čas držení nuly
 * - isZeroNow: zda je právě teď stabilní nula (pro hlášku)
 * - open, onClose: řízení modalu
 */
export default function LockCountdownModal({
  open,
  onClose,
  leftMs = 0,
  totalMs = 1000,
  isZeroNow = false,
}) {
  const safeTotal = totalMs > 0 ? totalMs : 1;
  const clampedLeft = Math.max(0, Math.min(leftMs, safeTotal));
  const progress = Math.round(((safeTotal - clampedLeft) / safeTotal) * 100);

  const secondsLeft = (clampedLeft / 1000).toFixed(1).replace(".", ",");

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Čekám na nulovou váhu</DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <LinearProgress variant="determinate" value={progress} />
        </Box>

        <Typography variant="body1" sx={{ mb: 1 }}>
          {isZeroNow
            ? "Nula je stabilní. Odemknu po doběhnutí odpočtu:"
            : "Váha není na nule — sundej balík a počkej na stabilní 0 kg."}
        </Typography>

        <Box sx={{ display: "flex", gap: 2, alignItems: "baseline" }}>
          <Typography variant="h4" component="div" sx={{ fontVariantNumeric: "tabular-nums" }}>
            {secondsLeft} s
          </Typography>
          <Typography color="text.secondary">
            z {Math.round(safeTotal / 100) / 10} s
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Skrýt</Button>
      </DialogActions>
    </Dialog>
  );
}
