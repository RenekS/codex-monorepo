import React, { useEffect, useRef, useState } from 'react';

function useOnClickOutside(ref, handler) {
  useEffect(() => {
    const l = (e) => { if (ref.current && !ref.current.contains(e.target)) handler(); };
    document.addEventListener('mousedown', l);
    return () => document.removeEventListener('mousedown', l);
  }, [ref, handler]);
}

export default function OwnerMultiSelect({ options = [], value = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  useOnClickOutside(ref, () => setOpen(false));

  const normalized = options
    .map(s => String(s || '').trim())
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i) // unique
    .sort((a,b)=>a.localeCompare(b,'cs'));

  const visible = q
    ? normalized.filter(o => o.toLowerCase().includes(q.toLowerCase()))
    : normalized;

  const allSelected = value.length && visible.every(v => value.includes(v));
  const toggleOne = (owner) => {
    if (value.includes(owner)) onChange(value.filter(v => v !== owner));
    else onChange([...value, owner]);
  };

  const btnLabel = () => {
    if (!value.length) return 'Vlastník (všichni)';
    if (value.length === 1) return value[0];
    return `Vlastníci (${value.length})`;
  };

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button
        onClick={()=>setOpen(o=>!o)}
        style={{
          width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:8,
          background:'#fff', textAlign:'left', cursor:'pointer'
        }}
        title={value.join(', ')}
      >
        {btnLabel()}
      </button>

      {open && (
        <div
          style={{
            position:'absolute', zIndex:1000, top:'calc(100% + 6px)', left:0,
            width:'100%', maxHeight:260, overflow:'auto',
            background:'#fff', border:'1px solid #e5e7eb', borderRadius:10,
            boxShadow:'0 8px 24px rgba(0,0,0,0.12)', padding:8
          }}
        >
          <div style={{display:'flex', gap:6, marginBottom:8}}>
            <input
              placeholder="Hledat vlastníka…"
              value={q} onChange={e=>setQ(e.target.value)}
              style={{flex:1, padding:'6px 8px', border:'1px solid #e5e7eb', borderRadius:8}}
            />
            <button
              onClick={() => onChange([])}
              style={{border:'none', background:'#fee2e2', color:'#991b1b', padding:'6px 10px', borderRadius:8, cursor:'pointer', fontWeight:700}}
            >
              Vyčistit
            </button>
          </div>

          <label style={{display:'flex', alignItems:'center', gap:8, padding:'4px 6px', borderBottom:'1px dashed #eee', marginBottom:6}}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e)=>{
                if (e.target.checked) {
                  // vybrat vše co je vidět
                  const merged = Array.from(new Set([...value, ...visible]));
                  onChange(merged);
                } else {
                  // odebrat vše co je vidět
                  onChange(value.filter(v => !visible.includes(v)));
                }
              }}
            />
            <b>Vybrat vše (aktuální seznam)</b>
          </label>

          {visible.length === 0 ? (
            <div style={{padding:'6px 2px', color:'#6b7280'}}>Nic nenalezeno…</div>
          ) : visible.map(owner => (
            <label key={owner} style={{display:'flex', alignItems:'center', gap:8, padding:'4px 6px', cursor:'pointer'}}>
              <input type="checkbox" checked={value.includes(owner)} onChange={()=>toggleOne(owner)} />
              <span>{owner}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
