// src/components/OrderDetail/OrderSummary.js

import React, { useState } from 'react';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, Table, TableBody, TableCell, TableHead, TableRow,
  CircularProgress
} from '@mui/material';
import { Download as DownloadIcon, ListAlt as ListAltIcon } from '@mui/icons-material';
import axios from 'axios';
import * as XLSX from 'xlsx';

// Pomocná funkce: rozklad na krabice/sáčky/ks
function breakdown(qty, boxSize, pouchSize) {
  const b = Number(boxSize) || 0;
  const p = Number(pouchSize) || 0;
  const boxes = b ? Math.floor(qty / b) : 0;
  const rem = qty - boxes * b;
  const pouches = p ? Math.floor(rem / p) : 0;
  const singles = rem - pouches * p;
  return { boxes, pouches, singles, pieces: qty };
}

// Pomocná funkce: souhrn za všechny položky
function calculateTotals(items, getter) {
  return items.reduce(
    (acc, it) => {
      const qty = getter(it) || 0;
      const { boxes, pouches, singles, pieces } = breakdown(qty, it.QTY_Box, it.QTY_Pouch);
      acc.boxes += boxes;
      acc.pouches += pouches;
      acc.singles += singles;
      acc.pieces += pieces;
      return acc;
    },
    { pieces: 0, boxes: 0, pouches: 0, singles: 0 }
  );
}

// Export Excel
function exportExcel(items, onlyErrors = false) {
  const header = [
    'Kód',
    'Název',
    'Objednáno',
    'Vychystáno',
    'Zkontrolováno',
    'Rozdíl kompletace (=Objednáno - Vychystáno)',
    'Rozdíl kontrola-kompletace (=Zkontrolováno - Vychystáno)',
    'Vydáno',
    'Rozdíl vydáno-kontrola (=Vydáno - Zkontrolováno)'
  ];
  const rows = items
    .filter(i => !onlyErrors || i.pickedDiff !== 0 || i.controlDiff !== 0 || i.deliveryDiff !== 0)
    .map(i => ([
      i.ItsItemName2,
      i.ItemName,
      i.SalesQty,
      i.picked,
      i.checked,
      i.pickedDiff,
      i.controlDiff,
      i.DeliveredQty,
      i.deliveryDiff
    ]));
  const data = [header, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Souhrn');
  XLSX.writeFile(
    workbook,
    onlyErrors ? 'souhrn-nesrovnalosti.xlsx' : 'souhrn-vsechny-pol.xlsx'
  );
}

export default function OrderSummary({
  orderDetail,
  packageCounts,
  controlCounts,
  controlMode,
  orderNumber
}) {
  const [open, setOpen] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  if (!orderDetail) return null;

  // Výpočet totals přes rozklad
  const totals = calculateTotals(orderDetail.Items, it => it.SalesQty);
  const scannedTotals = calculateTotals(orderDetail.Items, it => packageCounts[it.ItemId]);
  const controlTotals = calculateTotals(orderDetail.Items, it => controlCounts[it.ItemId]);

  const handleOpenDetail = async () => {
    setOpen(true);
    setModalLoading(true);
    try {
      const { data } = await axios.get(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/wms/order/${orderNumber}`
      );
      const items = data.items || [];
      const analyzed = items.map(it => {
        const picked = Number(it.Product_Picked) || 0;
        const checked = Number(it.Product_Picked_Check) || 0;
        const pickedDiff = (it.SalesQty - picked);
        const controlDiff = checked - picked;
        const deliveryDiff = (Number(it.DeliveredQty) || 0) - checked;
        return {
          ...it,
          picked,
          checked,
          pickedDiff,
          controlDiff,
          deliveryDiff
        };
      });
      setModalData(analyzed);
    } catch (e) {
      setModalData([]);
    }
    setModalLoading(false);
  };

  const errorRows = (modalData || []).filter(i =>
    i.pickedDiff !== 0 || i.controlDiff !== 0 || i.deliveryDiff !== 0
  );

  return (
    <>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        <Box>
          <Typography>Objednáno: <strong>{totals.pieces} ks</strong></Typography>
          <Typography>
            Kr: <strong>{totals.boxes}</strong>
            {' '}Sa: <strong>{totals.pouches}</strong>
            {' '}Ks: <strong>{totals.singles}</strong>
          </Typography>
        </Box>
        <Box sx={{ textAlign: { xs: 'left', sm: 'right' }, display: 'flex', flexDirection: 'column', gap: 1, alignItems: { xs: 'flex-start', sm: 'flex-end' } }}>
          <Typography>Naskenováno: <strong>{scannedTotals.pieces} ks</strong></Typography>
          <Typography>
            Kr: <strong>{scannedTotals.boxes}</strong>
            {' '}Sa: <strong>{scannedTotals.pouches}</strong>
            {' '}Ks: <strong>{scannedTotals.singles}</strong>
          </Typography>
          {controlMode && (
            <>
              <Typography sx={{ mt: 1 }}>Zkontrolováno: <strong>{controlTotals.pieces} ks</strong></Typography>
              <Typography>
                Kr: <strong>{controlTotals.boxes}</strong>
                {' '}Sa: <strong>{controlTotals.pouches}</strong>
                {' '}Ks: <strong>{controlTotals.singles}</strong>
              </Typography>
            </>
          )}
        </Box>
        <Button
          variant="outlined"
          startIcon={<ListAltIcon />}
          sx={{ whiteSpace: 'nowrap', alignSelf: 'flex-end' }}
          onClick={handleOpenDetail}
          disabled={!orderNumber}
        >
          Podrobnosti
        </Button>
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xl" fullWidth>
        <DialogTitle>Podrobný stav objednávky</DialogTitle>
        <DialogContent dividers>
          {modalLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
              <CircularProgress />
            </Box>
          )}
          {!modalLoading && modalData && (
            <>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Položky s nesouladem:
                </Typography>
                <Table size="small" sx={{ my: 2 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Kód</TableCell>
                      <TableCell>Název</TableCell>
                      <TableCell>Objednáno</TableCell>
                      <TableCell>Vychystáno</TableCell>
                      <TableCell>Zkontrolováno</TableCell>
                      <TableCell>
                        <Box>
                          Rozdíl kompletace
                          <Typography variant="caption" sx={{ display: 'block', color: '#888', fontSize: '0.75em' }}>
                            (=Objednáno - Vychystáno)
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          Rozdíl kontrola-kompletace
                          <Typography variant="caption" sx={{ display: 'block', color: '#888', fontSize: '0.75em' }}>
                            (=Zkontrolováno - Vychystáno)
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>Vydáno</TableCell>
                      <TableCell>
                        <Box>
                          Rozdíl vydáno-kontrola
                          <Typography variant="caption" sx={{ display: 'block', color: '#888', fontSize: '0.75em' }}>
                            (=Vydáno - Zkontrolováno)
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {errorRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center" sx={{ color: 'green', fontWeight: 600 }}>
                          Vše je v pořádku, žádné nesrovnalosti.
                        </TableCell>
                      </TableRow>
                    ) : (
                      errorRows.map((row, idx) => (
                        <TableRow key={row.ItemId + '-' + idx} sx={{ bgcolor: '#fffde7' }}>
                          <TableCell>{row.ItsItemName2}</TableCell>
                          <TableCell>{row.ItemName}</TableCell>
                          <TableCell align="right">{row.SalesQty}</TableCell>
                          <TableCell align="right">{row.picked}</TableCell>
                          <TableCell align="right">{row.checked}</TableCell>
                          <TableCell align="right" sx={{ color: row.pickedDiff !== 0 ? 'red' : 'inherit' }}>{row.pickedDiff}</TableCell>
                          <TableCell align="right" sx={{ color: row.controlDiff !== 0 ? 'red' : 'inherit' }}>{row.controlDiff}</TableCell>
                          <TableCell align="right">{row.DeliveredQty}</TableCell>
                          <TableCell align="right" sx={{ color: row.deliveryDiff !== 0 ? 'red' : 'inherit' }}>{row.deliveryDiff}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                <Button
                  variant="outlined"
                  color="success"
                  startIcon={<DownloadIcon />}
                  disabled={errorRows.length === 0}
                  onClick={() => exportExcel(errorRows, true)}
                >
                  Stáhnout Excel nesrovnalostí
                </Button>
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<DownloadIcon />}
                  onClick={() => exportExcel(modalData, false)}
                >
                  Stáhnout Excel všechny položky
                </Button>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2">Celkový přehled všech položek:</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Kód</TableCell>
                      <TableCell>Název</TableCell>
                      <TableCell>Objednáno</TableCell>
                      <TableCell>Vychystáno</TableCell>
                      <TableCell>Zkontrolováno</TableCell>
                      <TableCell>Vydáno</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {modalData.map(row => (
                      <TableRow key={row.ItemId}>
                        <TableCell>{row.ItsItemName2}</TableCell>
                        <TableCell>{row.ItemName}</TableCell>
                        <TableCell align="right">{row.SalesQty}</TableCell>
                        <TableCell align="right">{row.picked}</TableCell>
                        <TableCell align="right">{row.checked}</TableCell>
                        <TableCell align="right">{row.DeliveredQty}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Zavřít</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
