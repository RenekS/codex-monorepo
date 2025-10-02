import React from 'react';
import { Table, TableHead, TableBody, TableRow, TableCell } from '@mui/material';
import OrderTableRow from './OrderTableRow';

export default function OrderTable({
  items,
  packageCounts,
  controlCounts,
  controlMode,
  updatePackageCount,
  updateControlCount,
  handleOpenPad,
  handleDoubleClick,
  onMinusClick,     // ⬅️ NOVÉ (volitelné)
  onPlusClick       // ⬅️ NOVÉ (volitelné)
}) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow style={{ backgroundColor: '#f5f5f5' }}>
          <TableCell style={{ width: 60, minWidth: 60, whiteSpace: 'nowrap', fontSize: 13 }}>Kód produktu</TableCell>
          <TableCell style={{ fontSize: 13 }}>EAN kódy</TableCell>
          <TableCell style={{ fontSize: 13 }}>Název produktu</TableCell>
          <TableCell style={{ fontSize: 13 }}>Počet ks</TableCell>
          <TableCell align="center" style={{ fontSize: 13 }}>Kompletace</TableCell>
          {controlMode && (
            <TableCell align="center" style={{ fontSize: 13, color: "#1976d2", fontWeight: 700 }}>Kontrola</TableCell>
          )}
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map(item => (
          <OrderTableRow
            key={item.ItemId}
            item={item}
            packageCounts={packageCounts}
            controlCounts={controlCounts}
            controlMode={controlMode}
            updatePackageCount={updatePackageCount}
            updateControlCount={updateControlCount}
            handleOpenPad={handleOpenPad}
            handleDoubleClick={handleDoubleClick}
            onMinusClick={onMinusClick}   // ⬅️ předáváme dál
            onPlusClick={onPlusClick}     // ⬅️ předáváme dál
          />
        ))}
      </TableBody>
    </Table>
  );
}
