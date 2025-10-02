// =============================================================
// File: src/components/order/OrderTables.jsx
// =============================================================
import React from 'react';
import { Paper, Typography } from '@mui/material';
import OrderSummary from '../../components/OrderSummary';
import OrderTable from '../../components/OrderTable';

export default function OrderTables({ orderDetail, packageCounts, controlCounts, controlMode, updatePackageCount, updateControlCount, handleOpenPad, handleDoubleClick, onMinusClick, onPlusClick }) {
  const items = orderDetail?.Items ?? [];
  return (
    <>
      <Typography variant="h4" sx={{ mb: 2 }}>Objednávka č. {orderDetail.orderNumber}</Typography>
      <OrderSummary orderDetail={orderDetail} packageCounts={packageCounts} controlCounts={controlCounts} controlMode={controlMode} orderNumber={orderDetail.orderNumber} />
      <Paper>
        <OrderTable items={items} packageCounts={packageCounts} controlCounts={controlCounts} controlMode={controlMode} updatePackageCount={updatePackageCount} updateControlCount={updateControlCount} handleOpenPad={handleOpenPad} handleDoubleClick={handleDoubleClick} onMinusClick={onMinusClick} onPlusClick={onPlusClick} />
      </Paper>
    </>
  );
}
