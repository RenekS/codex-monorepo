// src/components/inventory/ScanPanel.jsx
import React from 'react';

export default function ScanPanel({
  onManualSubmit,
  scanInput,
  setScanInput,
  saving,
  inputRef,
}) {
  return (
    <form onSubmit={onManualSubmit} style={{ marginBottom: 12 }}>
      <label htmlFor="scanInput"><b>Manuální kód (fallback):</b>{' '}</label>
      <input
        id="scanInput"
        ref={inputRef}
        type="text"
        value={scanInput}
        onChange={e => setScanInput(e.target.value)}
        placeholder="(běžně netřeba — skener se chytá globálně)"
        autoComplete="off"
        disabled={saving}
        style={{ minWidth:420, color:'#000', backgroundColor:'#fff' }}
      />
      <button type="submit" style={{ marginLeft: 8 }} disabled={!scanInput || saving}>
        Přidat do relace
      </button>
    </form>
  );
}
