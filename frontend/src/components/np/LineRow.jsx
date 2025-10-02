// src/components/np/LineRow.jsx
import React, { memo } from "react";
import { Button, Box, Typography, TableRow, TableCell, Chip } from "@mui/material";
import { computeOrderedBoxes } from "../../utils/np";
import { getScanState, STATE_BG } from "../../utils/scanState";

const LineRow = memo(function LineRow({
  line,
  palletId,
  prepPosition,
  onInc,     // ponecháno kvůli kompatibilitě, ale nepoužíváme
  onDec,     // ponecháno kvůli kompatibilitě, ale nepoužíváme
  onNumPad,  // klik na číslo krabic (zůstává jako rychlá editace)
  // NOVÉ:
  allSlots = [],
  onOpenAllocate,
  onShowCartons, // ← přidej do parentu a předej dál z PalletAccordion
}) {
  const code = line.product_kod2 || line.item_number || "—";
  const orderedPcs = Number(line?.objednano || 0);
  const perCarton  = Number(line?.tk_ks_v_krabici || line?.pcs_per_carton || 0) || "—";
  const orderedBoxes = Number.isFinite(Number(line?.ordered_boxes))
    ? Number(line.ordered_boxes)
    : computeOrderedBoxes(line);

  const scanned = Number(line?.scanned_boxes || 0);
  const state   = getScanState(scanned, orderedBoxes);

  return (
    <TableRow
      hover
      sx={{
        backgroundColor: STATE_BG[state],
        ...(state === "over" ? { outline: "1px solid rgba(198,40,40,0.35)" } : null),
      }}
    >
      <TableCell>{code}</TableCell>
      <TableCell>
        <Typography>{line.tk_nazev || line.popis || "—"}</Typography>
      </TableCell>
      <TableCell>{orderedPcs || 0}</TableCell>
      <TableCell>{orderedBoxes}</TableCell>
      <TableCell>{perCarton}</TableCell>

      {/* Krabice naskenované */}
      <TableCell>
        {/* odebrána tlačítka − / + */}
        <Typography
          component="span"
          sx={{ mx: 1, fontWeight: 600, cursor: "pointer" }}
          title="Zadat počet krabic"
          onClick={() => onNumPad?.(line.id)}
        >
          {scanned}
        </Typography>
        <Typography component="span" variant="caption"> / {orderedBoxes}</Typography>
        <Button
          size="small"
          sx={{ ml: 1 }}
          onClick={() => {
            if (typeof onShowCartons === "function") onShowCartons(palletId, line);
            else onNumPad?.(line.id); // fallback pro starší parent
          }}
        >
          #
        </Button>
      </TableCell>

      {/* Pozice / Sloty + Umístit */}
      <TableCell>
        <Box sx={{ display: "inline-block", minWidth: 40, px: 1, py: 0.5, mx: 0.5, textAlign: "center", border: "1px solid #888", borderRadius: 1, fontWeight: "bold", fontSize: "1.1rem" }}>
          {prepPosition ?? "—"}
        </Box>
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          Primární: {line.slot_name || "nepřiřazeno"}
        </Typography>

        <Box sx={{ display:'flex', gap:0.5, flexWrap:'wrap', mb:1 }}>
          {allSlots.map(s=>(
            <Chip
              key={s.id}
              size="small"
              label={`${s.slot_name}${Number.isFinite(s.capacity)?` (${s.cartons_now}/${s.capacity})`:''}`}
              variant="outlined"
            />
          ))}
        </Box>

        <Button size="small" variant="outlined" onClick={()=>onOpenAllocate?.(line)}>
          Umístit
        </Button>
      </TableCell>
    </TableRow>
  );
});

export default LineRow;
