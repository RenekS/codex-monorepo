// =============================================================
// File: src/components/inventory/SummaryTable.jsx
// =============================================================
import React from 'react';

export default function SummaryTable({ summaryRows, onReassign, toUnassign, selectedSlotId }) {
  return (
    <section style={{ marginTop:16 }}>
      <div style={{ display:'flex', gap:12, alignItems:'center' }}>
        <h3>Souhrn / rozdíly</h3>
        <button
          onClick={onReassign}
          disabled={!toUnassign.length || !selectedSlotId}
          style={{ padding: '6px 10px', background: toUnassign.length ? '#1976d2' : '#bbb', color: '#fff', border: 'none', borderRadius: 4, cursor: toUnassign.length ? 'pointer' : 'not-allowed' }}
        >
          Přeřadit chybějící do NEZARAZENO
        </button>
      </div>
      <table border="1" cellPadding="6" style={{ borderCollapse:'collapse', width:'100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign:'left' }}>Produkt</th>
            <th>Ks/krabici</th>
            <th>Evidováno (kartony)</th>
            <th>Skutečnost v relaci (kartony)</th>
            <th>Δ kartony</th>
            <th>Evidováno (ks)</th>
            <th>Skutečnost v relaci (ks)</th>
            <th>Δ ks</th>
          </tr>
        </thead>
        <tbody>
          {summaryRows.length === 0 && (
            <tr><td colSpan={8} style={{ color:'#666' }}>Žádná data</td></tr>
          )}
          {summaryRows.map(r => (
            <tr key={r.product_code}>
              <td style={{ textAlign:'left' }}>{r.product_code}</td>
              <td style={{ textAlign:'right' }}>{r.upc}</td>
              <td style={{ textAlign:'right' }}>{r.baseline_cartons}</td>
              <td style={{ textAlign:'right' }}>{r.scanned_cartons}</td>
              <td style={{ textAlign:'right', color: r.delta_cartons > 0 ? 'green' : (r.delta_cartons < 0 ? 'red' : '#000') }}>
                {r.delta_cartons}
              </td>
              <td style={{ textAlign:'right' }}>{r.baseline_units}</td>
              <td style={{ textAlign:'right' }}>{r.scanned_units}</td>
              <td style={{ textAlign:'right', color: r.delta_units > 0 ? 'green' : (r.delta_units < 0 ? 'red' : '#000') }}>
                {r.delta_units}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}