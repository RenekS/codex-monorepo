// src/components/OrderDetail/QtyBreakdown.js

import React from 'react';
import { Typography } from '@mui/material';

export function breakdownDisplay(qty, boxSize, pouchSize) {
  const b = Number(boxSize) || 0;
  const p = Number(pouchSize) || 0;
  const boxes = b ? Math.floor(qty / b) : 0;
  const rem = qty - boxes * b;
  const pouches = p ? Math.floor(rem / p) : 0;
  const singles = rem - pouches * p;

  let parts = [];
  if (boxes) parts.push(`${boxes} kr`);
  if (pouches) parts.push(`${pouches} sá`);
  if (singles) parts.push(`${singles} ks`);
  if (!parts.length) parts.push('0 ks');
  return parts.join(', ');
}

export default function QtyBreakdown({ qty, boxSize, pouchSize }) {
  return (
    <Typography variant="caption" sx={{ display: 'block', fontWeight: 500 }}>
      {breakdownDisplay(qty, boxSize, pouchSize)}
    </Typography>
  );
}
