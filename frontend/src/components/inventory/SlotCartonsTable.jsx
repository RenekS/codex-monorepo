// =============================================================
// File: src/components/inventory/SlotCartonsTable.jsx
// =============================================================
import React from 'react';

export default function SlotCartonsTable({ slotCartons, onPrint }) {
  return (
    <section>
      <h3>Krabice v tomto slotu (před/po skenu) – přehled</h3>
      <table border="1" cellPadding="6" style={{ borderCollapse:'collapse', width:'100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign:'left' }}>Carton (QR)</th>
            <th style={{ textAlign:'left' }}>Produkt</th>
            <th style={{ textAlign:'right' }}>Ks/krabici</th>
            <th style={{ textAlign:'left' }}>Stav</th>
            <th style={{ textAlign:'center' }}>Tisk</th>
          </tr>
        </thead>
        <tbody>
          {slotCartons.length === 0 && (
            <tr><td colSpan={5} style={{ color:'#666' }}>Ve slotu zatím nic</td></tr>
          )}
          {slotCartons.map(c => (
            <tr key={c.carton_code} style={{ background: c.scanned ? '#e6ffe6' : (c.provisional ? '#f3f9ff' : 'transparent') }}>
              <td>{c.carton_code}{c.provisional ? ' (dočasné)' : ''}</td>
              <td>{c.product_code}</td>
              <td style={{ textAlign:'right' }}>{Number(c.upc || 0)}</td>
              <td>{c.scanned ? '✓ naskenováno' : 'nenaskenováno'}</td>
              <td style={{ textAlign:'center' }}>
                <button onClick={() => onPrint(c)} style={{ padding:'4px 8px', background:'#111', color:'#fff', border:'none', borderRadius:4 }}>
                  Tisk
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop:6, fontSize:12, color:'#555' }}>
        QR ve stejném slotu jen označíme (Δ=0). EAN vytvoří dočasnou šarži v UI; ostrá vznikne při commitu.
      </div>
    </section>
  );
}