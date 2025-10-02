// src/components/alloc/AllocateSlotsModal.jsx
import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import {
  Dialog, AppBar, Toolbar, IconButton, Typography, Box, Divider,
  TextField, Button, Chip, Table, TableHead, TableRow, TableCell, TableBody, Tooltip
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

function norm(v){ return (v==null?"":String(v)).trim(); }
const lc = (v)=>norm(v).toLowerCase();

function sameProduct(slot, productCode) {
  return !!norm(slot?.product_id) && lc(slot.product_id) === lc(productCode);
}
function isEmptySlot(slot) {
  const cartons = Number(slot?.cartons_count ?? slot?.carton_count ?? 0);
  const hasProd = !!norm(slot?.product_id);
  return cartons <= 0 && !hasProd;
}
function occupiedOtherProduct(slot, productCode) {
  const cartons = Number(slot?.cartons_count ?? slot?.carton_count ?? 0);
  const hasProd = !!norm(slot?.product_id);
  return (cartons > 0 || hasProd) && !sameProduct(slot, productCode);
}

/** Seřadí patra (desc) a vrátí max počet pozic per sekce a per patro pro stabilní mřížku. */
function prepareShelfGeometry(sections){
  const floorsSet = new Set();
  const maxPosPerSection = new Map(); // section_id -> max pos
  const slotByKey = new Map(); // `${section_id}:${floor}:${pos}` -> slot

  for (const sec of sections) {
    const slots = sec?.pallet_slots || sec?.palletSlots || [];
    let maxPos = 0;
    for (const sl of slots) {
      const f = Number(sl.floor_number ?? 0);
      const p = Number(sl.position ?? 0);
      floorsSet.add(f);
      if (p > maxPos) maxPos = p;
      slotByKey.set(`${sec.id}:${f}:${p}`, sl);
    }
    maxPosPerSection.set(sec.id, Math.max(1, maxPos || 1));
  }
  const floors = Array.from(floorsSet).sort((a,b)=>b-a);
  return { floors, maxPosPerSection, slotByKey };
}

export default function AllocateSlotsModal({
  open,
  onClose,
  warehouses,
  line,                 // { id, item_number, tk_nazev, scanned_boxes, ordered_boxes, ... }
  defaultCartonsToPlace,
  onSave                // (lineId, [{slot_id, cartons}])
}) {
  const productCode = norm(line?.item_number || "");
  const initialToPlace = Number.isFinite(Number(defaultCartonsToPlace))
    ? Number(defaultCartonsToPlace)
    : Number(line?.scanned_boxes ?? 0);

  // přidělení (slot_id -> cartons)
  const [assign, setAssign] = useState(new Map());
  const [cartonsToPlace, setCartonsToPlace] = useState(initialToPlace);

  // reset pouze při "novém" otevření (změní se line.id nebo z false->true)
  const openKeyRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const key = `${line?.id ?? "x"}`;
    if (openKeyRef.current !== key) {
      openKeyRef.current = key;
      setAssign(new Map());
      setCartonsToPlace(initialToPlace);
    }
    // záměrně BEZ warehouses v deps; klikání do minimapy nesmí nulu resetovat
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, line?.id, initialToPlace]);

  // suma zadaných alokací
  const remaining = useMemo(() => {
    const sum = Array.from(assign.values()).reduce((a, b) => a + Number(b || 0), 0);
    return Math.max(0, Number(cartonsToPlace || 0) - sum);
  }, [assign, cartonsToPlace]);

  // slot klik (povolíme jen prázdný NEBO se shodným produktem)
  const toggleSlot = useCallback((slot) => {
    const canSelect = isEmptySlot(slot) || sameProduct(slot, productCode);
    if (!canSelect) return;
    const slotId = slot.id;
    setAssign(prev => {
      const m = new Map(prev);
      if (m.has(slotId)) m.delete(slotId);
      else m.set(slotId, 1); // default 1
      return m;
    });
  }, [productCode]);

  // řádky tabulky: vybrané sloty + přítomné PRODUKT sloty (PRIMARY/SECONDARY)
  const tableRows = useMemo(() => {
    const rows = [];

    // 1) Přidej všechny přítomné sloty se stejným produktem (info + možnost doplnit)
    (warehouses || []).forEach(b => {
      (b.shelves || []).forEach(sh => {
        (sh.sections || []).forEach(sec => {
          const slots = sec?.pallet_slots || sec?.palletSlots || [];
          slots.forEach(sl => {
            if (!sameProduct(sl, productCode)) return;
            const cartons = Number(sl?.cartons_count ?? sl?.carton_count ?? 0);
            rows.push({
              slot_id: sl.id,
              slot_name: sl.slot_name || `Slot ${sl.id}`,
              place: `${b.name || b.id} / ${sh.name || sh.id} / ${sec.name || sec.id} / patro ${sl.floor_number}`,
              cartons_now: cartons,
              capacity: Number(sl?.max_cartons_capacity ?? sl?.capacity_cartons ?? NaN) || null,
              kind: sl?.is_primary ? "PRIMARY" : "SECONDARY",
              preexisting: true
            });
          });
        });
      });
    });

    // 2) Přidej vybrané (assign) – mohou být i ty z (1), ale to nevadí; sloučíme viz unique by slot_id
    const selected = [];
    for (const [slotId] of assign.entries()) {
      // najdi slot v warehouses
      let found = null;
      outer: for (const b of (warehouses || [])) {
        for (const sh of (b.shelves || [])) {
          for (const sec of (sh.sections || [])) {
            const slots = sec?.pallet_slots || sec?.palletSlots || [];
            for (const sl of slots) {
              if (sl.id === slotId) {
                found = { b, sh, sec, sl };
                break outer;
              }
            }
          }
        }
      }
      if (found) {
        const { b, sh, sec, sl } = found;
        const cartons = Number(sl?.cartons_count ?? sl?.carton_count ?? 0);
        selected.push({
          slot_id: sl.id,
          slot_name: sl.slot_name || `Slot ${sl.id}`,
          place: `${b.name || b.id} / ${sh.name || sh.id} / ${sec.name || sec.id} / patro ${sl.floor_number}`,
          cartons_now: cartons,
          capacity: Number(sl?.max_cartons_capacity ?? sl?.capacity_cartons ?? NaN) || null,
          kind: isEmptySlot(sl) ? "EMPTY" : (sl?.is_primary ? "PRIMARY" : "SECONDARY"),
          preexisting: false
        });
      }
    }

    // 3) Sloučit unikátně podle slot_id (přednost „preexisting:true“ řádku kvůli kind/obsazenosti)
    const byId = new Map();
    for (const r of [...rows, ...selected]) {
      if (!byId.has(r.slot_id)) byId.set(r.slot_id, r);
      else {
        const prev = byId.get(r.slot_id);
        // preferuj preexisting true
        if (prev.preexisting) continue;
        byId.set(r.slot_id, r);
      }
    }

    const out = Array.from(byId.values());
    // seřadit: PRIMARY, SECONDARY, EMPTY
    const order = { PRIMARY: 0, SECONDARY: 1, EMPTY: 2 };
    out.sort((a,b) => {
      const ka = order[a.kind] ?? 99;
      const kb = order[b.kind] ?? 99;
      if (ka !== kb) return ka - kb;
      return (b.cartons_now || 0) - (a.cartons_now || 0);
    });
    return out;
  }, [warehouses, productCode, assign]);

  const handleQtyChange = (slot_id, v) => {
    const val = Math.max(0, Number(v || 0));
    setAssign(prev => {
      const m = new Map(prev);
      if (val > 0) m.set(slot_id, val); else m.delete(slot_id);
      return m;
    });
  };

  const save = async () => {
    const payload = Array.from(assign.entries())
      .map(([slot_id, cartons]) => ({ slot_id, cartons: Number(cartons || 0) }))
      .filter(x => x.cartons > 0);
    await onSave?.(line.id, payload);
    onClose?.();
  };

  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      <AppBar sx={{ position: "sticky" }} color="primary">
        <Toolbar>
          <IconButton edge="start" onClick={onClose} aria-label="close">
            <CloseIcon />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1 }} variant="h6">
            Umístění zboží — {line?.tk_nazev || line?.item_number}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 2, display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 2 }}>
        {/* LEVÁ: MINIMAPA CELÉHO SKLADU */}
        <Box sx={{ display: "grid", gap: 2, alignContent: "start" }}>
          {(warehouses || []).map((b) => (
            <Box key={b.id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
              <Typography variant="subtitle1" sx={{ px: 1.5, pt: 1.25, pb: 0.5, fontWeight: 700 }}>
                {b.name || `Budova ${b.id}`}
              </Typography>

              {(b.shelves || []).map((sh) => {
                const sections = sh.sections || [];
                const { floors, maxPosPerSection, slotByKey } = prepareShelfGeometry(sections);

                return (
                  <Box key={sh.id} sx={{ p: 1.5, pt: 1 }}>
                    <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 600 }}>
                      Regál: {sh.name || sh.id}
                    </Typography>

                    {/* hlavička se jmény sekcí */}
                    <Box sx={{ display:"grid", gridTemplateColumns:`120px repeat(${sections.length}, 1fr)`, alignItems:"center", mb: 0.5 }}>
                      <Box />
                      {sections.map(sec => (
                        <Box key={sec.id} sx={{ textAlign:"center", fontSize:12, fontWeight:600 }}>{sec.name || sec.id}</Box>
                      ))}
                    </Box>

                    {/* patra */}
                    <Box sx={{ display:"grid", gap: 0.5 }}>
                      {floors.map(floor => (
                        <Box key={floor} sx={{ display:"grid", gridTemplateColumns:`120px repeat(${sections.length}, 1fr)`, alignItems:"center", gap:0.5 }}>
                          <Box sx={{ textAlign:"right", pr: 1, fontSize: 12, color: "text.secondary" }}>
                            Patro {floor}
                          </Box>

                          {sections.map(sec => {
                            const cols = maxPosPerSection.get(sec.id) || 1;
                            const cells = [];
                            for (let pos = 1; pos <= cols; pos++) {
                              const slot = slotByKey.get(`${sec.id}:${floor}:${pos}`);
                              if (!slot) {
                                cells.push(<Box key={`ph-${pos}`} sx={{ width: 18, height: 18 }} />);
                                continue;
                              }

                              const isSame = sameProduct(slot, productCode);
                              const isEmpty = isEmptySlot(slot);
                              const isOther = occupiedOtherProduct(slot, productCode);

                              // barvy
                              let bg = "transparent";
                              if (isSame)   bg = slot?.is_primary ? "success.main" : "info.main";
                              else if (isOther) bg = "warning.main";
                              else if (isEmpty) bg = "grey.300";

                              const selected = assign.has(slot.id);
                              const border = selected
                                ? "2px solid rgba(255,193,7,0.9)"
                                : (isSame || isOther || isEmpty ? "1px solid rgba(0,0,0,0.2)" : "1px solid rgba(0,0,0,0.05)");

                              const canSelect = isEmpty || isSame;
                              const title =
                                `${sec.name || sec.id} • patro ${floor}` +
                                (slot.slot_name ? ` • ${slot.slot_name}` : "") +
                                (isSame ? (slot.is_primary ? " • PRIMARY" : " • SECONDARY")
                                        : (isOther ? " • jiný produkt" : " • volný"));

                              cells.push(
                                <Tooltip title={title} key={slot.id}>
                                  <Box
                                    onClick={() => canSelect && toggleSlot(slot)}
                                    sx={{
                                      width: 18, height: 18,
                                      bgcolor: bg,
                                      border,
                                      borderRadius: "3px",
                                      cursor: canSelect ? "pointer" : "default",
                                      opacity: (isSame || isOther || isEmpty) ? 1 : 0.35
                                    }}
                                  />
                                </Tooltip>
                              );
                            }
                            return (
                              <Box key={sec.id} sx={{ display:"grid", gridTemplateColumns:`repeat(${cols}, 18px)`, gap:0.5 }}>
                                {cells}
                              </Box>
                            );
                          })}
                        </Box>
                      ))}
                    </Box>

                    {/* legenda */}
                    <Box sx={{ display:"flex", gap:2, mt:1, flexWrap:"wrap" }}>
                      <Box sx={{ display:"flex", alignItems:"center", gap:0.5 }}>
                        <Box sx={{ width:12, height:12, bgcolor:"success.main", borderRadius:"2px" }} />
                        <Typography variant="caption">Primární (náš produkt)</Typography>
                      </Box>
                      <Box sx={{ display:"flex", alignItems:"center", gap:0.5 }}>
                        <Box sx={{ width:12, height:12, bgcolor:"info.main", borderRadius:"2px" }} />
                        <Typography variant="caption">Sekundární (náš produkt)</Typography>
                      </Box>
                      <Box sx={{ display:"flex", alignItems:"center", gap:0.5 }}>
                        <Box sx={{ width:12, height:12, bgcolor:"warning.main", borderRadius:"2px" }} />
                        <Typography variant="caption">Obsazeno jiným produktem</Typography>
                      </Box>
                      <Box sx={{ display:"flex", alignItems:"center", gap:0.5 }}>
                        <Box sx={{ width:12, height:12, bgcolor:"grey.300", borderRadius:"2px" }} />
                        <Typography variant="caption">Volný slot (klikem přidáš)</Typography>
                      </Box>
                      <Box sx={{ display:"flex", alignItems:"center", gap:0.5 }}>
                        <Box sx={{ width:12, height:12, border:"2px solid rgba(255,193,7,0.9)", borderRadius:"2px" }} />
                        <Typography variant="caption">Vybraný slot</Typography>
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          ))}
        </Box>

        {/* PRAVÁ: TABULKA + ALOKACE */}
        <Box sx={{ display:"grid", gridTemplateRows:"auto 1fr auto", minHeight: 0 }}>
          <Box sx={{ display:"flex", gap:1, alignItems:"center", mb:1 }}>
            <Typography variant="subtitle1" sx={{ flex:1 }}>
              K rozdělení (krabic):
            </Typography>
            <TextField
              type="number"
              size="small"
              value={cartonsToPlace}
              onChange={(e)=>setCartonsToPlace(Number(e.target.value||0))}
              sx={{ width:120 }}
            />
          </Box>

          <Divider sx={{ mb: 1 }} />

          <Box sx={{ overflow: "auto", minHeight: 0 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Slot</TableCell>
                  <TableCell>Umístění</TableCell>
                  <TableCell align="right">Obsaz.</TableCell>
                  <TableCell align="right">Kapac.</TableCell>
                  <TableCell align="center">Typ</TableCell>
                  <TableCell align="right">Alokace</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.map(r => {
                  const val = assign.get(r.slot_id) || 0;
                  const canWrite = true; // případně omez: isEmpty || sameProduct
                  return (
                    <TableRow key={r.slot_id} hover>
                      <TableCell>
                        <Box sx={{ display:"flex", gap:0.75, alignItems:"center" }}>
                          {r.kind === "PRIMARY" && <Chip size="small" label="PRIMARY" color="success" variant="outlined" />}
                          {r.kind === "SECONDARY" && <Chip size="small" label="SECONDARY" color="info" variant="outlined" />}
                          {r.kind === "EMPTY" && <Chip size="small" label="VOLNÝ" color="default" variant="outlined" />}
                          <Typography>{r.slot_name}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">{r.place}</Typography>
                      </TableCell>
                      <TableCell align="right">{r.cartons_now}</TableCell>
                      <TableCell align="right">{r.capacity ?? "—"}</TableCell>
                      <TableCell align="center">{r.kind}</TableCell>
                      <TableCell align="right" style={{ whiteSpace: "nowrap" }}>
                        <TextField
                          type="number"
                          size="small"
                          value={val}
                          onChange={(e)=>handleQtyChange(r.slot_id, e.target.value)}
                          sx={{ width: 100 }}
                          inputProps={{ min:0 }}
                          disabled={!canWrite}
                        />
                        {val>0 && (
                          <Button sx={{ ml: 1 }} size="small" onClick={()=>handleQtyChange(r.slot_id, 0)}>Odebrat</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {tableRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" color="text.secondary">
                        Vyber sloty v minimapě (klik) nebo doplň alokaci k existujícím slotům se stejným produktem.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>

          <Box sx={{ display:"flex", justifyContent:"space-between", alignItems:"center", mt:2 }}>
            <Typography color={remaining>0 ? "error" : "success.main"}>
              Zbývá rozdělit: <b>{remaining}</b> krabic
            </Typography>
            <Box sx={{ display:"flex", gap:1 }}>
              <Button variant="outlined" onClick={onClose}>Zrušit</Button>
              <Button variant="contained" color="success" onClick={save} disabled={cartonsToPlace>0 && remaining>0}>
                Uložit umístění
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
}
