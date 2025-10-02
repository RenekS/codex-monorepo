import React from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Typography, Button } from "@mui/material";
import { UI_DECIMALS, RK_BADGE } from "./constants";

export default function ConfirmDialog({
  open,
  measured, refWeight, tolAbs,
  onCancel, onConfirmRK, onConfirmSetRef,
}) {
  return (
    <Dialog open={open} onClose={() => {}} fullWidth maxWidth="xs">
      <DialogTitle>Nesrovnalost ve váze</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 1 }}>Zjištěna odchylka proti referenci.</Typography>
        <Typography>Změřená váha: <b>{measured != null ? measured.toFixed(UI_DECIMALS) : "—"} kg</b></Typography>
        <Typography>Referenční váha: <b>{Number(refWeight || 0)} kg</b> ± <b>{Number(tolAbs || 0.2).toFixed(2)} kg</b></Typography>
        <Typography sx={{ mt: 2 }}>
          Chceš <b>stornovat</b>, <b>předat na ruční kontrolu</b> ({RK_BADGE}), nebo <b>nastavit tuto váhu jako referenční</b>?
        </Typography>
      </DialogContent>
      <DialogActions sx={{ pb: 2, gap: 1, flexWrap: "wrap" }}>
        <Button onClick={onCancel}>Storno (neukládat)</Button>
        <Button onClick={onConfirmRK} variant="contained" color="error">
          Předat na ruční kontrolu ({RK_BADGE})
        </Button>
        <Button onClick={onConfirmSetRef} variant="outlined" color="primary">
          Nastavit jako referenční váhu
        </Button>
      </DialogActions>
    </Dialog>
  );
}
