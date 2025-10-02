import React, { useState, useEffect } from "react";
import { Box, Typography, Dialog, DialogTitle, DialogContent, Snackbar, DialogActions, TextField, Button, Alert } from "@mui/material";
import { useParams } from "react-router-dom";
import axios from "axios";

import useNPDetailLogic from "../hooks/useNPDetailLogic";
import HeaderCard from "../components/np/HeaderCard";
import PalletSelector from "../components/np/PalletSelector";
import PalletAccordion from "../components/np/PalletAccordion";
import NumberPad from "../components/NumberPad";
import WeightDialog from "../components/np/WeightDialog";
import ScanWeighModal from "../components/scanweigh/scanweighModal/index.jsx";
import AllocateSlotsModal from "../components/alloc/AllocateSlotsModal";
import ScannedCartonsDialog from "../components/np/ScannedCartonsDialog"; // ← NOVÉ

export default function NP_Detail() {
  const { id } = useParams();
  const logic = useNPDetailLogic(id);
  const [editingLine, setEditingLine] = useState(null);

  // sklady pro kapacity/obsazenost slotů (warehouse/v2)
  const [warehouses, setWarehouses] = useState([]);
  useEffect(()=>{
    (async()=>{
      try{
        const url = `${process.env.REACT_APP_API_URL}/warehouse/v2?includeCartons=1`;
        const { data } = await axios.get(url);
        const fetched = Array.isArray(data?.warehouses)
          ? data.warehouses
          : (Array.isArray(data) ? data : []);
        setWarehouses(fetched);
      }catch(e){
        console.warn("Warehouse V2 load failed", e);
        setWarehouses([]);
      }
    })();
  },[]);

  // alokační modal
  const [allocOpen, setAllocOpen] = useState(false);
  const [allocLine, setAllocLine] = useState(null);
  const openAllocate = (line) => { setAllocLine(line); setAllocOpen(true); };
  const closeAllocate = () => { setAllocOpen(false); setAllocLine(null); };

  const saveAllocation = async (lineId, allocations)=>{
    try{
      await axios.post(`${process.env.REACT_APP_API_URL}/np/allocate-slots`, {
        line_id: lineId,
        allocations // [{slot_id, cartons}]
      });
      logic.setSnack({open:true, msg:"Umístění uloženo", sev:"success"});
    }catch(e){
      console.error("❌ allocate-slots", e);
      logic.setSnack({open:true, msg:"Chyba ukládání umístění", sev:"error"});
    }
  };

  // všechny sloty, které obsahují produkt (z warehouse v2)
  const getAllSlotsForProduct = (productCode)=>{
    const code = String(productCode||"").trim();
    if (!code) return [];
    const out = [];
    (warehouses||[]).forEach(b=>{
      (b.shelves||[]).forEach(sh=>{
        (sh.sections||[]).forEach(sec=>{
          const slots = sec?.pallet_slots || sec?.palletSlots || [];
          slots.forEach(sl=>{
            const cartons = Number(sl?.cartons_count ?? sl?.carton_count ?? 0);
            const cap = Number(sl?.capacity_cartons ?? sl?.max_cartons ?? NaN);
            const contains = (
              (String(sl?.product_id||"").trim()===code) ||
              (Array.isArray(sl?.products) && sl.products.some(p=>String(p?.product_code||"").trim()===code))
            );
            if (contains){
              out.push({
                id: sl.id,
                slot_name: sl.slot_name || `${sec.name || sec.id}-${sl.position ?? ""}`,
                cartons_now: cartons,
                capacity: Number.isFinite(cap) ? cap : null
              });
            }
          });
        });
      });
    });
    return out.sort((a,b)=> (b.capacity??9999)-(a.capacity??9999));
  };

  // === NOVÉ: dialog se seznamem naskenovaných balíků ===
  const [cartonsOpen, setCartonsOpen] = useState(false);
  const [cartonsLine, setCartonsLine] = useState(null);
  const [cartonsLoading, setCartonsLoading] = useState(false);
  const [cartons, setCartons] = useState([]);

  const onShowCartons = async (palletId, line) => {
    setCartonsLine(line);
    setCartonsOpen(true);
    setCartonsLoading(true);
    try {
      // GET /np/cartons/by-line?line_id=:lineId&pallet_id=:palletId
      const { data } = await axios.get(`${process.env.REACT_APP_API_URL}/np/cartons/by-line`, {
        params: { line_id: line.id, pallet_id: palletId }
      });
      const list = Array.isArray(data?.cartons) ? data.cartons : (Array.isArray(data) ? data : []);
      setCartons(list);
    } catch (e) {
      console.error("❌ load cartons", e);
      setCartons([]);
      logic.setSnack({ open:true, msg:"Nepodařilo se načíst balíky", sev:"error" });
    } finally {
      setCartonsLoading(false);
    }
  };

  const handleRemoveCarton = async (cartonId) => {
    try {
      // DELETE /np/cartons/:cartonId
      await axios.delete(`${process.env.REACT_APP_API_URL}/np/cartons/${encodeURIComponent(cartonId)}`);
      setCartons(prev => prev.filter(c => c.id !== cartonId));
      // snížit lokální počitadlo
      if (cartonsLine?.id) {
        const current = Object.values(logic.lines).flat().find(l => l.id === cartonsLine.id);
        const nb = Math.max(0, Number(current?.scanned_boxes || 0) - 1);
        logic.patchLine(cartonsLine.id, { scanned_boxes: nb });
      }
    } catch (e) {
      console.error("❌ remove carton", e);
      logic.setSnack({ open:true, msg:"Nelze odebrat balík", sev:"error" });
    }
  };

  const handleRemoveAll = async (lineId) => {
    if (!lineId) return;
    try {
      // DELETE /np/cartons/by-line  body: { line_id }
      await axios.delete(`${process.env.REACT_APP_API_URL}/np/cartons/by-line`, {
        data: { line_id: lineId }
      });
      setCartons([]);
      logic.patchLine(lineId, { scanned_boxes: 0 });
    } catch (e) {
      console.error("❌ remove all cartons", e);
      logic.setSnack({ open:true, msg:"Nelze odebrat všechny balíky", sev:"error" });
    }
  };

  const handleReprintCarton = async (cartonId) => {
    try {
      // POST /np/cartons/:cartonId/reprint
      await axios.post(`${process.env.REACT_APP_API_URL}/np/cartons/${encodeURIComponent(cartonId)}/reprint`);
      logic.setSnack({ open:true, msg:"Štítek odeslán na tisk", sev:"success" });
    } catch (e) {
      console.error("❌ reprint carton", e);
      logic.setSnack({ open:true, msg:"Nelze vytisknout štítek", sev:"error" });
    }
  };

  if (logic.loading) return <Typography>Načítám…</Typography>;
  if (!logic.header)  return <Typography>Záznam nenalezen</Typography>;

  return (
    <Box p={2}>
      <HeaderCard header={logic.header} />

      <PalletSelector
        uniqNos={logic.uniqNos}
        selNo={logic.selNo}
        setSelNo={logic.setSelNo}
        collapsed={logic.collapsed}
        setCollapsed={logic.setCollapsed}
        palletNoStats={logic.palletNoStats}
      />

      {logic.viewPallets.map(p => (
        <PalletAccordion
          key={p.id}
          pallet={p}
          linesOnPallet={
            typeof logic.getSortedLines === "function"
              ? logic.getSortedLines(p.id)
              : (logic.lines[p.id] || [])
          }
          onToggleChecked={logic.toggleChecked}
          onInc={logic.inc}
          onDec={logic.dec}
          onNumPad={setEditingLine}
          // NOVÉ ↓↓↓
          getAllSlotsForProduct={getAllSlotsForProduct}
          onOpenAllocate={openAllocate}
          onShowCartons={onShowCartons} // ← přidáno
        />
      ))}

      {editingLine && (
        <Dialog open onClose={()=>setEditingLine(null)}>
          <DialogTitle>Zadat počet krabic</DialogTitle>
          <DialogContent>
            <NumberPad
              initialValue={Object.values(logic.lines).flat().find(l=>l.id===editingLine).scanned_boxes}
              onSubmit={(v)=>{ logic.updateBoxes(editingLine, v); setEditingLine(null); }}
              onCancel={()=>setEditingLine(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Rychlý tisk — zadání N */}
      <Dialog open={logic.secretAskOpen} onClose={logic.cancelSecretCount}>
        <DialogTitle>Rychlý tisk — počet kusů</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            type="number"
            label="Počet N (1–999)"
            value={logic.secretCount}
            onChange={(e) => logic.setSecretCount(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
            inputProps={{ min:1, max:999 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={logic.cancelSecretCount}>Zrušit</Button>
          <Button variant="contained" onClick={logic.confirmSecretCount}>Potvrdit</Button>
        </DialogActions>
      </Dialog>

      <WeightDialog
        open={logic.modalOpen}
        onClose={()=>logic.setModalOpen(false)}
        onOk={logic.handleModalOk}
        line={logic.modalLine}
        palletIndex={
          logic.modalPallet && logic.modalLine
            ? (typeof logic.getPrepPosition === "function"
                ? logic.getPrepPosition(logic.modalPallet, logic.modalLine.id)
                : ((logic.lines[logic.modalPallet] || []).findIndex(l=>l.id===logic.modalLine.id) + 1))
            : undefined
        }
        manualWeight={logic.manualWeight}
        setManualWeight={logic.setManualWeight}
      />

      {logic.scanOpen && logic.scanCtx && (
        <ScanWeighModal
          open={logic.scanOpen}
          onClose={()=>{ logic.setScanOpen(false); logic.setScanCtx(null); logic.setScanStartArmed(false); logic.setScanPresetCount(0); }}
          line={logic.scanCtx.line}
          palletId={logic.scanCtx.palletId}
          ean={logic.scanCtx.ean}
          linesOnPallet={logic.lines[logic.scanCtx.palletId] || []}
          successAudio={logic.successAudio}
          errorAudio={logic.errorAudio}
          onSaved={logic.handleScanSaved}
          onLineUpdated={logic.handleLineUpdated}
          onRefUpdated={logic.handleRefUpdated}
          slotName={logic.scanCtx.line?.slot_name || null}
          startArmed={logic.scanStartArmed || false}
          presetCount={logic.scanPresetCount || 0}
          currentSelNo={logic.selNo}
          scanSelNo={logic.scanCtx.selNoAtScan}
          remainingAtScan={logic.scanCtx.remainingAtScan}
        />
      )}

      {/* Seznam naskenovaných balíků */}
      <ScannedCartonsDialog
        open={cartonsOpen}
        onClose={() => setCartonsOpen(false)}
        line={cartonsLine}
        cartons={cartons}
        loading={cartonsLoading}
        onRemoveCarton={handleRemoveCarton}
        onRemoveAll={handleRemoveAll}
        onReprintCarton={handleReprintCarton}
      />
  
      {/* NOVÉ: modal pro rozdělení do slotů */}
      {allocOpen && allocLine && (
        <AllocateSlotsModal
          open={allocOpen}
          onClose={closeAllocate}
          warehouses={warehouses}
          line={allocLine}
          defaultCartonsToPlace={allocLine.scanned_boxes}
          onSave={saveAllocation}
        />
      )}

      <Snackbar
        open={logic.snack.open}
        autoHideDuration={3500}
        onClose={()=>logic.setSnack(s=>({ ...s, open:false }))}
        anchorOrigin={{ vertical:"bottom", horizontal:"center" }}
      >
        <Alert severity={logic.snack.sev} onClose={()=>logic.setSnack(s=>({ ...s, open:false }))}>
          {logic.snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
