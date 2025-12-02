// =============================================================
// File: src/components/inventory/SlotCartonsTable.jsx
// =============================================================
import React from 'react';

export default function SlotCartonsTable({ slotCartons, onPrint , onDownload = () => {}}) {
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
                <button
                  onClick={() => onDownload(c)}
                  style={{ padding:'4px 8px', marginLeft:6, background:'#fff', color:'#111', border:'1px solid #999', borderRadius:4 }}
                  title="Stáhnout PDF"
                  aria-label="Stáhnout PDF"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
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