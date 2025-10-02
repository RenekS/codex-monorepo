import React, { useState, memo } from 'react';
import {
  Table, TableHead, TableRow, TableCell, TableBody,
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Select, MenuItem, IconButton, Tooltip, Popover, ClickAwayListener, Divider
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { addPalletSlot, deletePalletSlot } from './warehouseService';

/* ========================= Helpery ========================= */

const norm = (v) => (v == null ? '' : String(v).trim());

function displayNameFromSlot(slot) {
  const raw = typeof slot?.slot_name === 'string' ? slot.slot_name : '';
  const parts = raw.split('-S');
  return (parts[1] ?? raw) || raw || '';
}
const getSlotColor = (status) => {
  switch (status) {
    case 'obsazeno': return 'error.main';
    case 'rezervovano': return 'warning.main';
    case 'disabled': return 'grey.400';
    default: return 'success.light';
  }
};
const getCellColor = (count) => {
  if (count === 0) return 'error.main';
  if (count === 1) return 'warning.main';
  return 'inherit';
};
function stableSlotKey(slot) {
  const f = slot?.floor_number ?? '';
  const p = slot?.position ?? '';
  const n = slot?.slot_name ?? '';
  return `${f}|${p}|${n}`;
}
function dedupeSlots(slots) {
  const byId = new Map(); const byKey = new Map();
  (slots || []).forEach((s) => {
    if (s?.id != null) { if (!byId.has(s.id)) byId.set(s.id, s); }
    else { const k = stableSlotKey(s); if (!byKey.has(k)) byKey.set(k, s); }
  });
  return [...byId.values(), ...byKey.values()];
}
function sortCellSlots(a, b) {
  const pa = a?.position ?? 0; const pb = b?.position ?? 0;
  if (pa !== pb) return pa - pb;
  const ia = a?.id ?? 0; const ib = b?.id ?? 0;
  return ia - ib;
}

/* ========================= Mini UI prvky ========================= */

// Krabička s ikonou + x/xx (počet krabic / kapacita)
function CartonCountPill({ count, capacity }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.6,
        px: 0.8, py: 0.25,
        border: '1px solid',
        borderColor: 'grey.500',
        borderRadius: 1,
        bgcolor: 'background.paper',
        fontSize: '0.8rem',
        fontWeight: 700,
      }}
      title={`Krabice: ${count}${capacity ? ` / ${capacity}` : ''}`}
    >
      <Inventory2OutlinedIcon sx={{ fontSize: 16, opacity: 0.85 }} />
      {capacity ? `${count}/${capacity}` : count}
    </Box>
  );
}

// --- NOVÁ verze ---
// Indikátor zaplněnosti: 6 pater; A = 11 boxů/patro, B = 9 boxů/patro; plní se odspodu.
// rowGapPx řídí mezeru mezi patry (default 2px).
function PalletOccupancy({ cartonsCount = 0, cartonType = 'A', layers = 6, rowGapPx = 1 }) {
  const perLayer = cartonType === 'B' ? 9 : 11;
  const maxCartons = perLayer * layers;
  const filled = Math.max(0, Math.min(Number(cartonsCount) || 0, maxCartons));

  // rozpad do pater (odspodu)
  const layersData = [];
  let remaining = filled;
  for (let i = 0; i < layers; i++) {
    const fillThis = Math.min(perLayer, Math.max(0, remaining));
    layersData.push(fillThis);
    remaining -= fillThis;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column-reverse',
        width: 66,             // o něco užší
        px: 0.5,
        py: 0.5,
        borderLeft: '1px solid',
        borderColor: 'grey.400',
      }}
      title={`Zaplněno ${filled}/${maxCartons} krabic`}
    >
      {layersData.map((boxesFilled, layerIdx) => (
        <Box
          key={layerIdx}
          sx={{
            display: 'flex',
            height: 8,                  // pevná výška řádku = malé patro
            '& + &': { marginTop: `${rowGapPx}px` },  // jediný zdroj mezery mezi patry
          }}
        >
          {Array.from({ length: perLayer }).map((_, i) => {
            const isFilled = i < boxesFilled;
            return (
              <Box
                key={i}
                sx={{
                  width: 6,
                  height: '100%',
                  boxSizing: 'border-box',
                  bgcolor: isFilled ? 'success.main' : 'grey.300',
                  border: '1px solid',
                  borderColor: isFilled ? 'success.dark' : 'grey.400',
                }}
              />
            );
          })}
        </Box>
      ))}
    </Box>
  );
}


/* ========================= Slot Tile ========================= */

const SlotTile = memo(function SlotTile({ slot, sectionId, floorNumber, onConfigureCell }) {
  const displayName = displayNameFromSlot(slot);
  const cartonsCount = Number(slot?.cartons_count || slot?.carton_count || 0);
  const cartonType = (slot?.carton_type === 'B' ? 'B' : 'A');
  const perLayer = Number(slot?.per_layer_capacity || (cartonType === 'B' ? 9 : 11));
  const layers = Number(slot?.layers_capacity || 6);
  const capacity = perLayer * layers;

  const [openDetail, setOpenDetail] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const handleOpenDetail = (e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); setOpenDetail(true); };
  const handleCloseDetail = () => setOpenDetail(false);
  const handleConfigure = (e) => { e.stopPropagation(); onConfigureCell?.(sectionId, floorNumber); };

  const badge = slot?.is_primary ? 'P' : 'S';

  return (
    <>
      <Box
        sx={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'stretch',
          justifyContent: 'space-between',
          m: 0.35,
          border: '1px solid',
          borderColor: 'grey.400',
          bgcolor: getSlotColor(slot?.status),
          borderRadius: 1,
          overflow: 'hidden',
          minHeight: 62,     // kompaktněji
          minWidth: 170,     // kompaktněji
          pr: 0.5,
        }}
      >
        {/* Levý panel: název + kód + počet krabic s ikonou */}
        <Box sx={{ px: 1.1, py: 0.5, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <Typography variant="caption" sx={{ lineHeight: 1, whiteSpace: 'nowrap', fontWeight: 700 }}>
              {displayName || '—'}
            </Typography>
            <Box
              sx={{
                width: 18, height: 18, borderRadius: '50%',
                border: '1px solid', borderColor: 'grey.700',
                bgcolor: slot?.is_primary ? 'success.light' : 'warning.light',
                color: '#000',
                fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
              title={slot?.is_primary ? 'Primární slot' : 'Sekundární slot'}
            >
              {badge}
            </Box>
          </Box>

          {slot?.product_id && (
            <Typography variant="caption" sx={{ fontSize: '0.72rem', lineHeight: 1.2, mt: 0.2, whiteSpace: 'nowrap' }}>
              {slot.product_id}
            </Typography>
          )}

          {/* Počet krabic s ikonou (x/xx) */}
          <Box sx={{ mt: 0.35 }}>
            <CartonCountPill count={cartonsCount} capacity={capacity} />
          </Box>
        </Box>

        {/* Pravý panel: indikátor zaplněnosti (6 pater, plní se odspodu) */}
        <PalletOccupancy cartonsCount={cartonsCount} cartonType={cartonType} layers={layers} />

        {/* Akce vpravo */}
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.25, ml: 0.3 }}>
          <Tooltip title="Detail">
            <IconButton onClick={handleOpenDetail} size="small" sx={{ width: 26, height: 26 }}>
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Konfigurovat buňku">
            <IconButton onClick={handleConfigure} size="small" sx={{ width: 26, height: 26 }}>
              <SettingsOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Detail slotu */}
      <Popover
        open={openDetail}
        anchorEl={anchorEl}
        onClose={handleCloseDetail}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        disableRestoreFocus
        PaperProps={{ sx: { p: 1.2, maxWidth: 720 } }}
      >
        <ClickAwayListener onClickAway={handleCloseDetail}>
          <Box>
            <Typography variant="subtitle2">{displayName || '—'}</Typography>
            {slot?.product_id && (
              <Typography variant="body2" sx={{ mb: 1 }}>
                Produkt: <code>{slot.product_id}</code>
              </Typography>
            )}

            <Divider sx={{ my: 1 }} />

            <Typography variant="subtitle2" gutterBottom>
              Krabice ve slotu (jen se zůstatkem &gt; 0)
            </Typography>

            {Array.isArray(slot?.cartons_detail) && slot.cartons_detail.length ? (
              <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>carton_code</TableCell>
                    <TableCell align="right">Přijato (ks)</TableCell>
                    <TableCell align="right">Vydáno (ks)</TableCell>
                    <TableCell align="right">Zůstatek (ks)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {slot.cartons_detail
                    .filter(c => Number(c.units_remaining) > 0)
                    .map((c, idx) => (
                      <TableRow key={`${c.carton_code}-${idx}`}>
                        <TableCell><code>{c.carton_code || '-'}</code></TableCell>
                        <TableCell align="right">{Number(c.qty_units_in || 0)}</TableCell>
                        <TableCell align="right">{Number(c.issued_units || 0)}</TableCell>
                        <TableCell align="right"><strong>{Number(c.units_remaining || 0)}</strong></TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            ) : (
              <Typography variant="body2">Žádné krabice se zůstatkem.</Typography>
            )}
          </Box>
        </ClickAwayListener>
      </Popover>
    </>
  );
});

/* ====================== ShelfVisualization ====================== */

const ShelfVisualization = ({ shelf, onSave, onSlotUpdate }) => {
  const [localShelf, setLocalShelf] = useState(shelf ?? {});
  const sortedFloors = [...(localShelf?.floors ?? [])].sort(
    (a, b) => (b?.floor_number ?? 0) - (a?.floor_number ?? 0)
  );
  const sections = localShelf?.sections ?? [];

  const [openDialog, setOpenDialog] = useState(false);
  const [dialogSectionId, setDialogSectionId] = useState(null);
  const [dialogFloorNumber, setDialogFloorNumber] = useState(null);
  const [dialogSlots, setDialogSlots] = useState([]);

  const handleCellClick = (sectionId, floorNumber) => {
    setDialogSectionId(sectionId);
    setDialogFloorNumber(floorNumber);
    const section = sections.find((sec) => sec?.id === sectionId);
    const all = section?.pallet_slots || section?.palletSlots || [];
    const dedup = dedupeSlots(all);
    setDialogSlots(dedup.filter((slot) => slot?.floor_number === floorNumber).sort(sortCellSlots));
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setDialogSectionId(null);
    setDialogFloorNumber(null);
    setDialogSlots([]);
  };

  const handleAddSlot = async () => {
    try {
      const newSlotData = {
        sectionId: dialogSectionId,
        floorNumber: dialogFloorNumber,
        position: dialogSlots.length + 1,
        productId: null,
        status: 'volno',
      };
      const result = await addPalletSlot(newSlotData);
      setDialogSlots((prev) =>
        [...prev, { ...newSlotData, id: result?.slotId ?? undefined, floor_number: dialogFloorNumber }].sort(sortCellSlots)
      );
    } catch (error) {
      console.error('Chyba při přidávání slotu:', error);
    }
  };

  const handleRemoveSlot = async (index) => {
    const slot = dialogSlots[index];
    try {
      await deletePalletSlot(slot?.id);
    } catch (error) {
      console.error('Chyba při mazání slotu:', error);
    }
    setDialogSlots((prev) => {
      const arr = [...prev]; arr.splice(index, 1);
      return arr.sort(sortCellSlots);
    });
  };

  const handleSlotChange = (index, field, value) => {
    setDialogSlots((prev) => {
      const arr = [...prev];
      arr[index] = { ...arr[index], [field]: value };
      return arr.sort(sortCellSlots);
    });
  };

  const handleDialogSave = () => {
    const updatedSections = (localShelf?.sections ?? []).map((sec) => {
      if (sec?.id !== dialogSectionId) return sec;
      const all = sec.pallet_slots || sec.palletSlots || [];
      const others = all.filter((s) => s?.floor_number !== dialogFloorNumber);
      const combined = [...others, ...dialogSlots].sort(sortCellSlots);
      return sec.pallet_slots ? { ...sec, pallet_slots: combined } : { ...sec, palletSlots: combined };
    });
    setLocalShelf({ ...(localShelf ?? {}), sections: updatedSections });
    onSlotUpdate && onSlotUpdate(dialogSectionId, dialogSlots);
    handleCloseDialog();
  };

  const handleSaveAll = () => onSave && onSave(localShelf);

  return (
    <Box mt={2} mb={4}>
      <Typography variant="h6" gutterBottom>
        Regál: {localShelf?.name ?? '(bez názvu)'}
      </Typography>

      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Patro (výška)</TableCell>
            {sections.map((sec) => (
              <TableCell key={sec?.id} align="center">
                {sec?.name ?? ''}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedFloors.map((floor) => (
            <TableRow key={floor?.floor_number}>
              <TableCell>{`Patro ${floor?.floor_number ?? ''} (${floor?.height ?? ''} m)`}</TableCell>

              {sections.map((sec) => {
                const all = sec?.pallet_slots || sec?.palletSlots || [];
                const dedup = dedupeSlots(all);
                const cellSlots = dedup
                  .filter((slot) => slot?.floor_number === floor?.floor_number)
                  .sort(sortCellSlots);
                const count = cellSlots.length;

                if (count === 0) {
                  return (
                    <TableCell
                      key={sec?.id}
                      align="center"
                      sx={{ bgcolor: getCellColor(count), cursor: 'pointer', color: '#fff', whiteSpace: 'nowrap', px: 1, py: 0.5 }}
                      onClick={() => handleCellClick(sec?.id, floor?.floor_number)}
                    >
                      <Typography variant="subtitle1">0</Typography>
                    </TableCell>
                  );
                }

                const primarySlots = cellSlots.filter((s) => !!s?.is_primary);
                const secondarySlots = cellSlots.filter((s) => !s?.is_primary);

                return (
                  <TableCell key={sec?.id} align="center" sx={{ whiteSpace: 'nowrap' }}>
                    {primarySlots.length > 0 && (
                      <Box display="flex" flexWrap="wrap" justifyContent="center" sx={{ cursor: 'default', mb: secondarySlots.length ? 0.5 : 0 }}>
                        {primarySlots.map((s) => {
                          const key = s?.id ?? stableSlotKey(s);
                          return (
                            <SlotTile
                              key={key}
                              slot={s}
                              sectionId={sec?.id}
                              floorNumber={floor?.floor_number}
                              onConfigureCell={handleCellClick}
                            />
                          );
                        })}
                      </Box>
                    )}

                    {secondarySlots.length > 0 && (
                      <Box display="flex" flexWrap="wrap" justifyContent="center" sx={{ cursor: 'default' }}>
                        {secondarySlots.map((s) => {
                          const key = s?.id ?? stableSlotKey(s);
                          return (
                            <SlotTile
                              key={key}
                              slot={s}
                              sectionId={sec?.id}
                              floorNumber={floor?.floor_number}
                              onConfigureCell={handleCellClick}
                            />
                          );
                        })}
                      </Box>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Box mt={2} display="flex" justifyContent="flex-end">
        <Button variant="contained" color="primary" onClick={handleSaveAll}>
          Uložit změny
        </Button>
      </Box>

      {/* Dialog – správa slotů */}
      <Dialog open={openDialog} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle>Konfigurace paletových míst</DialogTitle>
        <DialogContent>
          {dialogSlots.length === 0 ? (
            <Typography variant="body1" sx={{ mb: 2 }}>
              V této buňce nejsou žádná paletová místa.
            </Typography>
          ) : (
            dialogSlots.map((slot, index) => (
              <Box key={slot?.id ?? `${stableSlotKey(slot)}-${index}`} sx={{ mb: 2, border: '1px solid #ccc', p: 1.2, borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Slot #{index + 1}
                </Typography>

                <TextField
                  label="Position"
                  type="number"
                  value={slot?.position ?? ''}
                  onChange={(e) => handleSlotChange(index, 'position', parseInt(e.target.value, 10))}
                  fullWidth
                  margin="dense"
                />

                <TextField
                  label="Product ID (primární)"
                  value={slot?.product_id ?? ''}
                  onChange={(e) => handleSlotChange(index, 'product_id', e.target.value)}
                  fullWidth
                  margin="dense"
                />

                <Select
                  fullWidth
                  margin="dense"
                  value={slot?.status ?? 'volno'}
                  onChange={(e) => handleSlotChange(index, 'status', e.target.value)}
                >
                  <MenuItem value="volno">Volno</MenuItem>
                  <MenuItem value="obsazeno">Obsazeno</MenuItem>
                  <MenuItem value="rezervovano">Rezervováno</MenuItem>
                  <MenuItem value="disabled">Deaktivováno</MenuItem>
                </Select>

                <Box mt={1}>
                  <Button variant="outlined" color="error" onClick={() => handleRemoveSlot(index)}>
                    Odebrat slot
                  </Button>
                </Box>
              </Box>
            ))
          )}
          <Box mt={2}>
            <Button variant="outlined" onClick={handleAddSlot}>
              Přidat slot
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Zrušit</Button>
          <Button onClick={handleDialogSave} variant="contained" color="primary">
            Uložit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ShelfVisualization;
