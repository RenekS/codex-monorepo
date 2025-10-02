import React from 'react';

export default function ScannedSessionTable({
  scannedRows,
  editingUpcMap = {},
  changeRowUpc,   // (uid, val)
  saveRowUpc,     // (uid)
  cancelRowUpc,   // (uid)
  deleteScanAt,
  onPrint
}) {
  return (
    <section>
      <h3>Naskenováno v této relaci ({scannedRows.length})</h3>
      <table border="1" cellPadding="6" style={{ borderCollapse:'collapse', width:'100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign:'left' }}>Kód</th>
            <th style={{ textAlign:'left' }}>Typ</th>
            <th style={{ textAlign:'left' }}>Produkt</th>
            <th style={{ textAlign:'right' }}>Dopad (kartony)</th>
            <th style={{ textAlign:'right' }}>Ks/krabici</th>
            <th style={{ textAlign:'left' }}>Pozn.</th>
            <th style={{ textAlign:'center' }}>Akce</th>
          </tr>
        </thead>
        <tbody>
          {scannedRows.length === 0 && (
            <tr><td colSpan={7} style={{ color:'#666' }}>Zatím nic naskenováno…</td></tr>
          )}
          {scannedRows.map((row, i) => {
            const effectiveUpc = Number(row.upc_override ?? row.upc ?? 0) || 0;
            const displayVal =
              editingUpcMap[row.uid] !== undefined
                ? editingUpcMap[row.uid]
                : effectiveUpc;

            const onKeyDown = (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
              if (e.key === 'Escape') {
                // zahodit lokální změny a odejít
                cancelRowUpc?.(row.uid);
                e.currentTarget.blur();
              }
            };
            const onBlur = () => saveRowUpc?.(row.uid);

            return (
              <tr key={row.uid} style={{ background: row.bad ? '#ffe6e6' : 'transparent' }}>
                <td>{row.raw}</td>
                <td>{row.kind}</td>
                <td>{row.product_code || '—'}</td>
                <td style={{ textAlign:'right' }}>{row.impact_cartons}</td>
                <td style={{ textAlign:'right' }}>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={displayVal}
                    onChange={e => changeRowUpc?.(row.uid, e.target.value)}
                    onKeyDown={onKeyDown}
                    onBlur={onBlur}
                    style={{ width: 90 }}
                    title="Uprav Ks/krabici (uloží se při opuštění buňky nebo Enter)"
                  />
                </td>
                <td>{row.error || ''}</td>
                <td style={{ textAlign:'center' }}>
                  <button
                    onClick={() => onPrint?.(row)}
                    style={{ padding:'4px 8px', marginRight:6, background:'#111', color:'#fff', border:'none', borderRadius:4 }}
                  >
                    Tisk
                  </button>
                  <button
                    onClick={() => deleteScanAt(i)}
                    style={{ padding:'4px 8px', background:'#c62828', color:'#fff', border:'none', borderRadius:4 }}
                  >
                    Smazat
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
