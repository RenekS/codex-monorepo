import React, { useMemo, useState } from 'react';
import {
  Dialog, AppBar, Toolbar, IconButton, Typography, Box,
  TextField, Tooltip, Divider, InputAdornment
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';

function norm(v) {
  return (v == null ? '' : String(v)).trim();
}

function lc(v) {
  return norm(v).toLowerCase();
}

function collectAllProductCodes(warehouses) {
  const set = new Set();
  (warehouses || []).forEach(b => {
    (b.shelves || []).forEach(sh => {
      (sh.sections || []).forEach(sec => {
        const slots = sec?.pallet_slots || sec?.palletSlots || [];
        slots.forEach(sl => {
          if (sl?.product_id) set.add(norm(sl.product_id));
          if (Array.isArray(sl?.products)) {
            sl.products.forEach(p => {
              if (p?.product_code) set.add(norm(p.product_code));
            });
          }
        });
      });
    });
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'cs'));
}

function slotHasProduct(slot, q) {
  if (!q) return false;
  const needle = lc(q);
  if (lc(slot?.product_id).includes(needle)) return true;
  if (Array.isArray(slot?.products)) {
    return slot.products.some(p => lc(p.product_code).includes(needle));
  }
  return false;
}

function CellMini({ section, floorNumber, searchTerm }) {
  const slots = useMemo(() => {
    const all = section?.pallet_slots || section?.palletSlots || [];
    return all
      .filter(s => s?.floor_number === floorNumber)
      .sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0));
  }, [section, floorNumber]);

  if (slots.length === 0) {
    return (
      <Box sx={{ height: 22, border: '1px solid', borderColor: 'grey.300', bgcolor: 'grey.50' }} />
    );
  }

  return (
    <Box sx={{ height: 22, border: '1px solid', borderColor: 'grey.400', display: 'flex' }}>
      {slots.map((slot, i) => {
        const cartons = Number(slot?.cartons_count ?? slot?.carton_count ?? 0);
        const hasGoods = cartons > 0;
        const hit = slotHasProduct(slot, searchTerm);

        return (
          <Tooltip
            key={slot?.id ?? `${section?.id}-${floorNumber}-${i}`}
            title={
              `${norm(section?.name)} • patro ${floorNumber}` +
              (slot?.slot_name ? ` • ${slot.slot_name}` : '') +
              (slot?.product_id ? ` • ${slot.product_id}` : '')
            }
          >
            <Box
              sx={{
                flex: 1,
                bgcolor: hit ? 'warning.light' : (hasGoods ? 'success.light' : 'grey.200'),
                borderLeft: i ? '1px solid' : 'none',
                borderLeftColor: 'grey.400',
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
}

export default function ShelfMiniMapModal({ open, onClose, warehouses }) {
  const [q, setQ] = useState('');

  const suggestions = useMemo(() => {
    const all = collectAllProductCodes(warehouses);
    const s = lc(q);
    if (!s) return all.slice(0, 10);
    return all.filter(code => lc(code).includes(s)).slice(0, 10);
  }, [warehouses, q]);

  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      <AppBar sx={{ position: 'sticky' }}>
  <Toolbar>
    <IconButton edge="start" onClick={onClose} aria-label="close">
  <CloseIcon sx={{ color: 'black' }} />
</IconButton>
    
    <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
      Minimapa skladu
    </Typography>
    <TextField
      size="small"
      placeholder="Hledat kód produktu (např. PR14MF.5428)…"
      value={q}
      onChange={(e) => setQ(e.target.value)}
      sx={{ minWidth: 360, bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 1 }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon sx={{ color: 'inherit' }} />
          </InputAdornment>
        ),
      }}
    />
    
  </Toolbar>
</AppBar>


      {/* našeptávač (jednoduchý) */}
      <Box sx={{ p: 1, display: q ? 'block' : 'none' }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {suggestions.map(s => (
            <Box
              key={s}
              onClick={() => setQ(s)}
              sx={{
                px: 1, py: 0.5, bgcolor: 'grey.100', border: '1px solid', borderColor: 'grey.300',
                borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'grey.200' }
              }}
            >
              <code>{s}</code>
            </Box>
          ))}
        </Box>
      </Box>

      <Divider />

      {/* plátno s mřížkou (po regálech) */}
      <Box sx={{ p: 2, display: 'grid', gap: 2 }}>
        {(warehouses || []).map((b) => (
          <Box key={b.id}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              {b.name || `Budova ${b.id}`}
            </Typography>

            {(b.shelves || []).map((sh) => {
              const floors = (sh.floors || []).slice().sort((a, b) => (b.floor_number ?? 0) - (a.floor_number ?? 0));
              const sections = sh.sections || [];
              return (
                <Box key={sh.id} sx={{ mb: 3 }}>
                  <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 600 }}>
                    Regál: {sh.name || sh.id}
                  </Typography>

                  <Box sx={{ overflowX: 'auto' }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: `160px repeat(${sections.length}, 1fr)`, gap: 0.5, minWidth: 560 }}>
                      {/* hlavička sekcí */}
                      <Box />
                      {sections.map(sec => (
                        <Box key={sec.id} sx={{ textAlign: 'center', fontSize: 12, fontWeight: 600 }}>
                          {sec.name}
                        </Box>
                      ))}

                      {/* řádky pater */}
                      {floors.map(fl => (
                        <React.Fragment key={fl.floor_number}>
                          <Box sx={{ alignSelf: 'center', pr: 1, textAlign: 'right', fontSize: 12 }}>
                            Patro {fl.floor_number} ({fl.height} m)
                          </Box>
                          {sections.map(sec => (
                            <CellMini
                              key={`${sec.id}-${fl.floor_number}`}
                              section={sec}
                              floorNumber={fl.floor_number}
                              searchTerm={q}
                            />
                          ))}
                        </React.Fragment>
                      ))}
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Dialog>
  );
}
