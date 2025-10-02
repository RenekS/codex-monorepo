import { Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, TextField, Button } from "@mui/material";
import { computeOrderedBoxes } from "../../utils/np";

export default function WeightDialog({ open, onClose, onOk, line, palletIndex, manualWeight, setManualWeight }) {
  const realPieces = () => {
    if (!line || !manualWeight) return "?";
    const pcsInCarton = Number(line.tk_ks_v_krabici || line.pcs_per_carton || 0);
    const refWeight   = Number(line.gross_weight_ctn_kg || 0);
    if (!pcsInCarton || !refWeight) return "?";
    const perPiece = refWeight / pcsInCarton;
    return perPiece ? Math.round(parseFloat(manualWeight) / perPiece) : "?";
  };

  const diff = () => {
    if (!line || !manualWeight) return { v:"?", c:"text.primary" };
    const d = parseFloat(manualWeight) - Number(line.gross_weight_ctn_kg || 0);
    return { v:d.toFixed(2), c: d>0 ? "error.main" : d<0 ? "success.main" : "text.primary" };
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ textAlign:"center", fontSize:"2rem" }}>
        {palletIndex ?? "-"}
      </DialogTitle>
      <DialogContent>
        {line && (
          <Box>
            <Typography variant="h6">{line.tk_nazev}</Typography>
            <Typography>Číslo položky: {line.item_number}</Typography>

            <Box mt={2}>
              <Typography>Objednáno krabic: {Number.isFinite(Number(line?.ordered_boxes)) ? line.ordered_boxes : computeOrderedBoxes(line)}</Typography>
              <Typography>Aktuální krabic: {line.scanned_boxes}</Typography>
              <Typography>Ks v kr (deklar.): {line.tk_ks_v_krabici ?? line.pcs_per_carton ?? "—"}</Typography>
              <Typography>Sklad (slot): {line.slot_name || "nepřiřazeno"}</Typography>
            </Box>

            <Box mt={2}>
              <TextField fullWidth label="Aktuální váha krabice (kg)" type="number"
                value={manualWeight} onChange={e=>setManualWeight(e.target.value)} sx={{ mb:1 }} />
              <Typography>Referenční váha krabice: {line.gross_weight_ctn_kg} kg</Typography>
              <Typography>
                Rozdíl: <Box component="span" sx={{ color: diff().c, fontWeight:"bold" }}>{diff().v} kg</Box>
              </Typography>
              <Typography>Odhad reálného počtu kusů v krabici: {realPieces()}</Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ pb:3 }}>
        <Button variant="contained" color="success" onClick={onOk}>OK</Button>
        <Button variant="outlined" color="error" onClick={onClose}>Zrušit</Button>
      </DialogActions>
    </Dialog>
  );
}
