import React from 'react';
import { TableRow, TableCell, Box, Button, Typography } from '@mui/material';
import QtyBreakdown from './QtyBreakdown';

export default function OrderTableRow({
  item,
  packageCounts,
  controlCounts,
  controlMode,
  updatePackageCount,
  updateControlCount,
  handleOpenPad,
  handleDoubleClick,
  onMinusClick,   // ⬅️ NOVÉ (volitelné)
  onPlusClick     // ⬅️ NOVÉ (volitelné)
}) {
  const totalQty   = item.SalesQty;
  const pickedQty  = packageCounts[item.ItemId] || 0;
  const controlQty = controlCounts[item.ItemId] || 0;
  const diff       = controlQty - pickedQty;

  const bgColor = (controlMode
    ? (controlQty === pickedQty ? '#d0f2e7' : '#fff7d6')
    : (pickedQty === totalQty ? '#d0f2e7' : pickedQty > 0 ? '#fff7d6' : '#fbe9e9'));

  // --- Ovládací prvky pro KONTROLU (zůstává stejné) ---
  const controlControls = (
    <Box sx={{
      display: 'flex',
      flexDirection: { xs: 'column', md: 'row' },
      alignItems: 'center',
      gap: 1,
      mt: 0
    }}>
      <Button
        variant="contained"
        color="success"
        onClick={() => updateControlCount(
          item.ItemId,
          controlQty + 1,
          totalQty,
          item.slot_names?.[0]?.slot_name
        )}
        sx={{ minWidth: 36, minHeight: 36, fontSize: 18, p: 0 }}
      >
        +
      </Button>

      <Typography
        onDoubleClick={() => handleDoubleClick(item.ItemId, totalQty)}
        sx={{
          fontWeight: 'bold',
          fontSize: 18,
          minWidth: 30,
          textAlign: 'center',
          cursor: 'pointer',
          my: { xs: 0.5, md: 0 }
        }}
      >
        {controlQty}
      </Typography>

      <Button
        variant="contained"
        color="error"
        onClick={() => updateControlCount(
          item.ItemId,
          Math.max(controlQty - 1, 0),
          totalQty,
          item.slot_names?.[0]?.slot_name
        )}
        sx={{ minWidth: 36, minHeight: 36, fontSize: 18, p: 0 }}
      >
        &minus;
      </Button>

      <Button
        variant="outlined"
        onClick={() => handleOpenPad(item.ItemId)}
        sx={{ minWidth: 32, minHeight: 32, fontSize: 18, p: 0, mt: { xs: 0.5, md: 0 }, ml: { xs: 0, md: 1 } }}
      >
        #
      </Button>
    </Box>
  );

  // --- Ovládací prvky pro KOMPLETACI ---
  // pokud controlMode = false: −/＋ spouští onMinusClick/onPlusClick (modaly/kompletaci)
  // pokud controlMode = true: chovají se jako dřív (mění pickedQty)
  const controls = (
    <Box sx={{
      display: 'flex',
      flexDirection: { xs: 'column', md: 'row' },
      alignItems: 'center',
      gap: 1,
      mt: 0
    }}>
      <Button
        variant="contained"
        color="success"
        onClick={() => {
          if (!controlMode && typeof onPlusClick === 'function') {
            onPlusClick(item);                       // ⬅️ otevře kompletaci na produktu
          } else {
            updatePackageCount(                      // původní chování
              item.ItemId,
              pickedQty + 1,
              totalQty,
              item.slot_names?.[0]?.slot_name
            );
          }
        }}
        sx={{ minWidth: 36, minHeight: 36, fontSize: 18, p: 0 }}
      >
        +
      </Button>

      <Typography
        onDoubleClick={() => handleDoubleClick(item.ItemId, totalQty)}
        sx={{
          fontWeight: 'bold',
          fontSize: 18,
          minWidth: 30,
          textAlign: 'center',
          cursor: 'pointer',
          my: { xs: 0.5, md: 0 }
        }}
      >
        {pickedQty}
      </Typography>

      <Button
        variant="contained"
        color="error"
        onClick={() => {
          if (!controlMode && typeof onMinusClick === 'function') {
            onMinusClick(item);                      // ⬅️ otevře modal pro odebrání naskenovaných
          } else {
            updatePackageCount(                      // původní chování
              item.ItemId,
              Math.max(pickedQty - 1, 0),
              totalQty,
              item.slot_names?.[0]?.slot_name
            );
          }
        }}
        sx={{ minWidth: 36, minHeight: 36, fontSize: 18, p: 0 }}
      >
        &minus;
      </Button>

      <Button
        variant="outlined"
        onClick={() => handleOpenPad(item.ItemId)}
        sx={{ minWidth: 32, minHeight: 32, fontSize: 18, p: 0, mt: { xs: 0.5, md: 0 }, ml: { xs: 0, md: 1 } }}
      >
        #
      </Button>
    </Box>
  );

  const slotChips = item.slot_names?.map(s => (
    <Box
      key={s.slot_name}
      sx={{
        px: 1,
        py: 0.25,
        borderRadius: 1,
        bgcolor: s.slot_name.toLowerCase().includes('paleta') ? '#ffe0b2' : '#e0e0e0',
        mr: 0.5,
        mt: 0
      }}
    >
      <Typography variant="caption">{s.slot_name}</Typography>
    </Box>
  ));

  return (
    <TableRow style={{ backgroundColor: bgColor }}>
      <TableCell style={{ width: 60, minWidth: 60, whiteSpace: 'nowrap', fontSize: 14 }}>
        {item.ItsItemName2}
        <br />
        <Typography variant="caption">{item.ItemId}</Typography>
      </TableCell>

      <TableCell style={{ fontSize: 12 }}>
        {item.EAN_Base && <Typography>Ks: {item.EAN_Base}</Typography>}
        {item.EAN_Pouch && <Typography>Sá: {item.EAN_Pouch}</Typography>}
        {item.EAN_Box && <Typography>Kr: {item.EAN_Box}</Typography>}
        {!item.EAN_Base && item.BarCode && <Typography>{item.BarCode}</Typography>}
      </TableCell>

      <TableCell style={{ fontSize: 14 }}>
        <Typography sx={{ fontWeight: 'bold' }}>{item.ItemName}</Typography>

        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 1,
          background: 'rgba(0,0,0,0.02)',
          borderRadius: 1,
          p: 1,
          mt: 0.5,
          mb: 0.5,
          fontSize: 13
        }}>
          {/* Balení */}
          <Box>
            <Typography variant="caption" sx={{ color: '#666', fontWeight: 500 }}>Balení:</Typography><br />
            <Typography variant="caption" sx={{ color: '#333' }}>
              Sáček: <b>{item.QTY_Pouch ?? '-'}</b> ks<br />
              Krabice: <b>{item.QTY_Box ?? '-'}</b> ks
            </Typography>
          </Box>

          {/* Hmotnost */}
          <Box>
            <Typography variant="caption" sx={{ color: '#666', fontWeight: 500 }}>Hmotnost:</Typography><br />
            <Typography variant="caption" sx={{ color: '#333', fontStyle: 'italic' }}>
              {item.NetWeight?.toFixed(3) ?? '?'} kg/ks<br />
              {(item.NetWeight && item.SalesQty) ? `${(item.NetWeight * item.SalesQty).toFixed(1)} kg celk.` : ''}
            </Typography>
          </Box>

          {/* Zásoba */}
          <Box>
            <Typography variant="caption" sx={{ color: '#666', fontWeight: 500 }}>Zásoba:</Typography><br />
            <Typography variant="caption" sx={{ color: '#333' }}>
              Skladem: <b>{item.totalPhysicalInvent}</b><br />
              Rezervováno: <b>{item.totalReservPhysical}</b>
            </Typography>
          </Box>

          {/* Pohyb */}
          <Box>
            <Typography variant="caption" sx={{ color: '#666', fontWeight: 500 }}>Pohyb:</Typography><br />
            <Typography variant="caption" sx={{ color: '#333' }}>
              Objednáno: <b>{item.SalesQty}</b><br />
              Vydáno: <b>{item.DeliveredQty}</b>
            </Typography>
          </Box>
        </Box>
      </TableCell>

      {/* Počet ks (rozpad + celkový počet) */}
      <TableCell style={{ padding: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ flex: 1, borderBottom: '1px solid #ccc', px: 1, py: 0.5 }}>
            <Typography variant="body2">
              <QtyBreakdown qty={totalQty} boxSize={item.QTY_Box} pouchSize={item.QTY_Pouch} />
            </Typography>
          </Box>
          <Box sx={{ flex: 1, px: 1, py: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="h6">{totalQty}</Typography>
          </Box>
        </Box>
      </TableCell>

      {/* Kompletace */}
      <TableCell align="center">
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {controls}
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>{slotChips}</Box>
        </Box>
      </TableCell>

      {/* Kontrola (jen když je controlMode zapnutý) */}
      {controlMode && (
        <TableCell align="center">
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {controlControls}
            </Box>
            <Typography variant="caption" sx={{ color: diff === 0 ? 'green' : 'red', fontWeight: 700 }}>
              Rozdíl: {diff}
            </Typography>
          </Box>
        </TableCell>
      )}
    </TableRow>
  );
}
