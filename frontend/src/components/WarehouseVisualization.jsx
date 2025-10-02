import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Select, MenuItem, FormControl, InputLabel, Button } from '@mui/material';
import ShelfVisualization from './ShelfVisualization';
import ShelfMiniMapModal from './ShelfMiniMapModal';
import { getWarehouses, getWarehousesV2 } from './warehouseService';

/** vyrobí recon index podle product_code (Kod) → { type, ax, wh, delta, axItemId } */
function buildReconIndex(reconciliation) {
  if (!reconciliation) return {};
  if (reconciliation.byProduct && typeof reconciliation.byProduct === 'object') {
    // pokud backend už pošle byProduct, použij rovnou
    return reconciliation.byProduct;
  }
  const idx = {};
  if (reconciliation.byAxItemId) {
    for (const [axItemId, rec] of Object.entries(reconciliation.byAxItemId)) {
      const ax = rec.ax || {};
      const wh = rec.wh || {};
      const delta = rec.delta || {};
      const products = Array.isArray(rec.products) ? rec.products : [];
      products.forEach((p) => {
        const code = String(p.product_code || '').trim();
        if (!code) return;
        idx[code] = { type: 'match', axItemId, ax, wh, delta };
      });
    }
  }
  if (reconciliation.unmappedProducts) {
    for (const [code, r] of Object.entries(reconciliation.unmappedProducts)) {
      const wh = {
        physicalUnits: Number(r.wh_units_physical || 0),
        reservedUnits: Number(r.wh_units_reserved || 0),
        freeUnits:     Number(r.wh_units_free || 0),
      };
      idx[code] = { type: 'unmapped', wh };
    }
  }
  return idx;
}

/** projde strom a doplní slot.is_primary, pokud by chyběl */
function ensurePrimaryFlag(warehouses) {
  return (warehouses || []).map((b) => ({
    ...b,
    shelves: (b.shelves || []).map((sh) => ({
      ...sh,
      sections: (sh.sections || []).map((sec) => ({
        ...sec,
        pallet_slots: (sec.pallet_slots || sec.palletSlots || []).map((sl) => ({
          ...sl,
          is_primary: typeof sl.is_primary === 'boolean' ? sl.is_primary : !!sl.product_id,
        })),
      })),
    })),
  }));
}

const WarehouseVisualization = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(null);
  const [reconIndex, setReconIndex] = useState({});

  // stav pro fullscreen mini-mapu (celý dataset)
  const [miniMapOpen, setMiniMapOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchWarehouses() {
      try {
        // primárně nový endpoint s rozpadem krabic a reconciliation
        const dataV2 = await getWarehousesV2({ includeCartons: 1, includeRecon: 1 });
        if (cancelled) return;

        const fetched = Array.isArray(dataV2?.warehouses)
          ? dataV2.warehouses
          : (Array.isArray(dataV2) ? dataV2 : []);

        const withPrimary = ensurePrimaryFlag(fetched);
        setWarehouses(withPrimary);

        const recon = buildReconIndex(dataV2?.reconciliation);
        setReconIndex(recon);

        if (withPrimary.length > 0) {
          setSelectedWarehouseId(withPrimary[0].id);
        }
      } catch (error) {
        console.warn('V2 endpoint selhal, zkouším fallback /api/warehouse:', error);
        try {
          const data = await getWarehouses();
          if (cancelled) return;
          const fetched = data.warehouses ? data.warehouses : data;
          const withPrimary = ensurePrimaryFlag(fetched);
          setWarehouses(withPrimary);
          setReconIndex({}); // fallback nemá reconciliation
          if (withPrimary && withPrimary.length > 0) {
            setSelectedWarehouseId(withPrimary[0].id);
          }
        } catch (e2) {
          console.error('Chyba při načítání skladů (fallback):', e2);
          setWarehouses([]);
          setReconIndex({});
        }
      }
    }
    fetchWarehouses();
    return () => { cancelled = true; };
  }, []);

  const handleWarehouseChange = (event) => {
    setSelectedWarehouseId(event.target.value);
  };

  const selectedWarehouse = useMemo(
    () => (warehouses.find((wh) => wh.id === selectedWarehouseId) || warehouses[0]),
    [warehouses, selectedWarehouseId]
  );

  const openMiniMap = () => setMiniMapOpen(true);
  const closeMiniMap = () => setMiniMapOpen(false);

  return (
    <Box p={2}>
      <Typography variant="h4" gutterBottom>
        Vizualizace skladu
      </Typography>

      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button variant="contained" size="small" onClick={openMiniMap}>
          Otevřít minimapu skladů
        </Button>
      </Box>

      {warehouses.length > 1 && (
        <FormControl fullWidth variant="outlined" sx={{ mb: 2 }}>
          <InputLabel id="warehouse-select-label">Vyberte sklad</InputLabel>
          <Select
            labelId="warehouse-select-label"
            value={selectedWarehouse?.id || ''}
            label="Vyberte sklad"
            onChange={handleWarehouseChange}
          >
            {warehouses.map((wh) => (
              <MenuItem key={wh.id} value={wh.id}>
                {wh.name || wh.id}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {selectedWarehouse ? (
        <Box>
          <Typography variant="h5" gutterBottom>
            Sklad: {selectedWarehouse.name || selectedWarehouse.id}
          </Typography>

          {selectedWarehouse.shelves && selectedWarehouse.shelves.length > 0 ? (
            selectedWarehouse.shelves.map((shelf) => (
              <Box key={shelf.id} sx={{ mb: 3 }}>
                {/* Horní lišta každého regálu – můžeš si nechat i lokální mapu regálu */}
                {/* <Button variant="outlined" size="small" onClick={() => /* otevřít lokální mapu *\/ null}>
                  Mapa regálu
                </Button> */}

                <ShelfVisualization
                  shelf={shelf}
                  // posíláme reconciliation index pro Δ/U atd.
                  recon={reconIndex}
                />
              </Box>
            ))
          ) : (
            <Typography variant="body1">
              V tomto skladu nejsou žádné regály.
            </Typography>
          )}
        </Box>
      ) : (
        <Typography variant="body1">
          Nebyl nalezen žádný sklad.
        </Typography>
      )}

      {/* Fullscreen modal s mini-mapou pro VŠECHNY sklady */}
      <ShelfMiniMapModal
        open={miniMapOpen}
        onClose={closeMiniMap}
        warehouses={warehouses}
      />
    </Box>
  );
};

export default WarehouseVisualization;
