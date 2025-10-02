import React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, List, ListItem, ListItemText, Stack, Typography, Divider
} from "@mui/material";

/**
 * Seznam naskenovaných balíků (cartons) pro daný řádek.
 * Endpointy doděláme později — teď jen volá callbacky, které si napojíš v parentu.
 *
 * Props:
 * - open, onClose
 * - line: objekt řádku (kvůli titulku)
 * - cartons: [{ id, carton_code, weight, created_at }, ...]
 * - onRemoveCarton(cartonId)
 * - onRemoveAll(lineId)
 * - onReprintCarton(cartonId)
 */
export default function ScannedCartonsDialog({
  open, onClose,
  line,
  cartons = [],
  onRemoveCarton,
  onRemoveAll,
  onReprintCarton
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Naskenované balíky — {line?.tk_nazev || line?.popis || line?.item_number || "řádek"}
      </DialogTitle>
      <DialogContent dividers>
        {cartons.length === 0 ? (
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            Zatím tu nic není.
          </Typography>
        ) : (
          <List dense>
            {cartons.map((c, i) => (
              <React.Fragment key={c.id ?? i}>
                <ListItem
                  secondaryAction={
                    <Stack direction="row" spacing={1}>
                      <Button size="small" onClick={() => onReprintCarton?.(c.id)}>Tisk</Button>
                      <Button size="small" color="error" onClick={() => onRemoveCarton?.(c.id)}>Odebrat</Button>
                    </Stack>
                  }
                >
                  <ListItemText
                    primary={c.carton_code || "(bez kódu)"}
                    secondary={
                      <>
                        {typeof c.weight !== "undefined" && <span>váha: {c.weight} kg • </span>}
                        {c.created_at ? <span>{new Date(c.created_at).toLocaleString()}</span> : null}
                      </>
                    }
                  />
                </ListItem>
                {i < cartons.length - 1 && <Divider component="li" />}
              </React.Fragment>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={() => onRemoveAll?.(line?.id)} disabled={!line}>Odebrat vše</Button>
        <Button onClick={onClose}>Zavřít</Button>
      </DialogActions>
    </Dialog>
  );
}
