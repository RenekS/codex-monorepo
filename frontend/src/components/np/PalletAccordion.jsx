// src/components/np/PalletAccordion.jsx
import React from "react";
import {
  Accordion, AccordionSummary, AccordionDetails,
  Grid, Checkbox, Table, TableHead, TableRow, TableCell, TableBody, Typography
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LineRow from "./LineRow";

export default function PalletAccordion({
  pallet,
  linesOnPallet,
  onToggleChecked,
  onInc,
  onDec,
  onNumPad,
  // NOVÉ:
  getAllSlotsForProduct,
  onOpenAllocate,
  onShowCartons, // ← PŘIDÁNO
}) {
  return (
    <Accordion defaultExpanded sx={{ mb:2 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon/>}>
        <Grid container alignItems="center" spacing={2}>
          <Grid item xs={4}><Typography variant="h6">Paleta {pallet.pallet_no}</Typography></Grid>
          <Grid item xs={2}>GW: {pallet.pallet_weight} kg</Grid>
          <Grid item xs={2}>Objem: {pallet.volume_cbm} cbm</Grid>
          <Grid item xs={2}>
            <Checkbox
              checked={!!pallet.checked}
              onChange={()=>onToggleChecked?.(pallet.id, !pallet.checked)}
            />{" "}Zkontrolováno
          </Grid>
        </Grid>
      </AccordionSummary>
      <AccordionDetails>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Kód</TableCell>
              <TableCell>Název</TableCell>
              <TableCell>Objednáno&nbsp;(ks)</TableCell>
              <TableCell>Objednáno&nbsp;(kr)</TableCell>
              <TableCell>Ks&nbsp;v&nbsp;kr</TableCell>
              <TableCell>Krabic</TableCell>
              <TableCell>Pozice / sloty</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {linesOnPallet.map((l, i) => (
              <LineRow
                key={l.id}
                line={l}
                palletId={pallet.id}
                prepPosition={i + 1}
                onInc={onInc}
                onDec={onDec}
                onNumPad={onNumPad}
                // NOVÉ:
                allSlots={getAllSlotsForProduct ? getAllSlotsForProduct(l.item_number) : []}
                onOpenAllocate={onOpenAllocate}
                onShowCartons={onShowCartons} // ← PŘEDÁNO DOLŮ
              />
            ))}
          </TableBody>
        </Table>
      </AccordionDetails>
    </Accordion>
  );
}
