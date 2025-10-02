// src/components/inventory/SlotFilter.jsx
import React from 'react';

export default function SlotFilter({
  slotFilter,
  setSlotFilter,
  onlyUninventorized,
  setOnlyUninventorized,
  selectedSlotId,
  onSelectSlot,
  filteredSlots,
  slots,
  loadingSlots,
}) {
  const inventorizedCount = slots.filter(s => String(s.inventarisation) === '1' || Number(s.inventarised) === 1).length;

  const isInventorized = (s) =>
    String(s.inventarisation) === '1' || Number(s.inventarised) === 1;

  return (
    <div style={{ marginBottom: 12, display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
      <label htmlFor="slotFilter"><b>Vyhledat slot:</b></label>
      <input
        id="slotFilter"
        type="text"
        value={slotFilter}
        onChange={e => setSlotFilter(e.target.value)}
        placeholder="např. S14"
        style={{ width:180, color:'#000', background:'#fff' }}
        title="Piš část názvu slotu – seznam se filtruje"
      />

      <label style={{ display:'flex', alignItems:'center', gap:6 }}>
        <input
          type="checkbox"
          checked={onlyUninventorized}
          onChange={e => setOnlyUninventorized(e.target.checked)}
        />
        Inventarizovat (zobrazit jen neinventarizované)
      </label>

      <label htmlFor="slotSelect" style={{ marginLeft:12 }}><b>Vyber slot:</b></label>
      <select
        id="slotSelect"
        value={selectedSlotId}
        onChange={onSelectSlot}
        disabled={loadingSlots}
        style={{ color:'#000', backgroundColor:'#fff', border:'1px solid #ccc', minWidth:260 }}
      >
        <option value="" disabled style={{ color:'#000', backgroundColor:'#fff' }}>
          — zvol paletové místo —
        </option>
        {filteredSlots.map(s => {
          const inv = isInventorized(s);
          return (
            <option
              key={s.id}
              value={s.id}
              style={{
                color:'#000',
                backgroundColor: inv ? '#e8f5e9' : '#fff' // ✅ zelené zvýraznění inventarizovaných
              }}
              title={inv ? 'Inventarizováno' : 'Neinventarizováno'}
            >
              {s.slot_name}
            </option>
          );
        })}
      </select>
      <span style={{ color:'#666', fontSize:12 }}>
        {filteredSlots.length}/{slots.length}
        {!onlyUninventorized && (
          <> • inventarizováno: {inventorizedCount}</>
        )}
      </span>
    </div>
  );
}
