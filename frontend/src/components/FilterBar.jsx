import React, { useEffect, useMemo, useState } from 'react';
import OwnerMultiSelect from './OwnerMultiSelect';

export default function FilterBar({
  filters, setFilters, onReset, ownerOptions = [],
  plannerVisible, setPlannerVisible,
}) {
  const set = (patch) => setFilters(prev => ({ ...prev, ...patch }));

  // --- Collapse / expand (persist) ---
  const LS_KEY = 'km_filters_collapsed';
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(LS_KEY) === '1'; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem(LS_KEY, collapsed ? '1' : '0'); } catch {} }, [collapsed]);

  // --- Chips (aktivní filtry) ---
  const { activeCount, chips } = useMemo(() => {
    const ch = [];
    const nonEmpty = (v) => v !== '' && v !== null && v !== undefined;
    if (nonEmpty(filters.q))                 ch.push(`Hledat: ${filters.q}`);
    if (nonEmpty(filters.PSC_like))          ch.push(`PSČ: ${filters.PSC_like}`);
    if (Array.isArray(filters.Vlastnik_in) && filters.Vlastnik_in.length) {
      const a = filters.Vlastnik_in;
      ch.push(a.length <= 2 ? `Vlastník: ${a.join(', ')}` : `Vlastníci: ${a.length}`);
    }
    if (nonEmpty(filters.Rating_in))         ch.push(`Rating: ${filters.Rating_in}`);
    if (nonEmpty(filters.Stav_in))           ch.push(`Stav: ${filters.Stav_in}`);
    if (nonEmpty(filters.min_2025_kc))       ch.push(`2025 ≥ ${filters.min_2025_kc}`);
    if (nonEmpty(filters.max_2025_kc))       ch.push(`2025 ≤ ${filters.max_2025_kc}`);
    if (nonEmpty(filters.next_activity_days_max)) ch.push(`Do naplán.: ${filters.next_activity_days_max} d`);
    if (nonEmpty(filters.last_activity_days_max)) ch.push(`Od poslední: ${filters.last_activity_days_max} d`);
    return { activeCount: ch.length, chips: ch };
  }, [filters]);

  const Chip = ({ children }) => (
    <span title={String(children)} style={{
      fontSize: 12, color:'#111', background:'#f3f4f6',
      border:'1px solid #e5e7eb', borderRadius:999, padding:'4px 8px', whiteSpace:'nowrap'
    }}>{children}</span>
  );

  return (
    <div style={{
      width:'100%', background:'rgba(255,255,255,0.96)', backdropFilter:'blur(4px)',
      border:'1px solid rgba(0,0,0,0.08)', boxShadow:'0 6px 16px rgba(0,0,0,0.12)',
      borderRadius:12, padding:12,
    }}>
      {/* Header řádek */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom: collapsed ? 0 : 8,minWidth:0}}>
        {/* Levo: název + (v collapsed režimu) chips inline */}
        <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0,flexGrow:1}}>
          <div style={{fontWeight:800,fontSize:16,flex:'0 0 auto'}}>Filtry</div>
          {collapsed && (
            <div style={{
              flex:'1 1 auto', minWidth:0, overflowX:'auto',
              display:'flex', alignItems:'center', gap:6, padding:'2px 4px'
            }}>
              {chips.length === 0 ? (
                <span style={{fontSize:13,color:'#6b7280'}}>Žádné aktivní filtry.</span>
              ) : chips.map((c,i)=><Chip key={i}>{c}</Chip>)}
            </div>
          )}
        </div>

        {/* Vpravo: přepínač plánovače + Sbalit/Rozbalit + Reset */}
        <div style={{display:'flex',gap:8,flex:'0 0 auto'}}>
          <button
            onClick={() => {
              setPlannerVisible(v => {
                const nv = !v;
                try { localStorage.setItem('km_planner_visible', nv ? '1' : '0'); } catch {}
                return nv;
              });
            }}
            title={plannerVisible ? 'Skrýt plánovač' : 'Zobrazit plánovač'}
            style={{
              border:'1px solid #e5e7eb',
              background: plannerVisible ? '#16a34a' : '#f3f4f6',
              color: plannerVisible ? '#fff' : '#111',
              padding:'6px 10px', borderRadius:999, cursor:'pointer', fontWeight:700
            }}
          >
            Plánovač: {plannerVisible ? 'zap' : 'vyp'}
          </button>

          <button
            onClick={() => setCollapsed(c => !c)}
            style={{border:'none',background:'#111',color:'#fff',padding:'6px 10px',borderRadius:8,cursor:'pointer',fontWeight:700}}
            title={collapsed ? 'Rozbalit filtry' : 'Sbalit filtry'}
          >
            {collapsed ? 'Rozbalit ▾' : 'Sbalit ▴'}
          </button>

          <button
            onClick={onReset}
            style={{border:'none',background:'#eef2ff',color:'#1f2937',padding:'6px 10px',borderRadius:8,cursor:'pointer',fontWeight:700}}
            title="Vynulovat všechny filtry"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Rozbalený grid s poli (beze změn) */}
      {!collapsed && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(12, 1fr)',gap:8,alignItems:'center'}}>
          <div style={{gridColumn:'span 4'}}>
            <div style={{fontSize:12,color:'#6b7280'}}>Hledat (jméno/adresa)</div>
            <input
              value={filters.q || ''} onChange={e=>set({ q:e.target.value })} placeholder="např. Praha, Trans..."
              style={{width:'100%',padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:8}}
            />
          </div>
          <div style={{gridColumn:'span 2'}}>
            <div style={{fontSize:12,color:'#6b7280'}}>PSČ (LIKE)</div>
            <input
              value={filters.PSC_like || ''} onChange={e=>set({ PSC_like:e.target.value })} placeholder="např. 69"
              style={{width:'100%',padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:8}}
            />
          </div>
          <div style={{gridColumn:'span 3'}}>
            <div style={{fontSize:12,color:'#6b7280'}}>Vlastník</div>
            <OwnerMultiSelect
              options={ownerOptions} value={filters.Vlastnik_in || []}
              onChange={(arr)=>set({ Vlastnik_in: arr })}
            />
          </div>
          <div style={{gridColumn:'span 1'}}>
            <div style={{fontSize:12,color:'#6b7280'}}>Rating</div>
            <select
              value={filters.Rating_in || ''} onChange={(e)=>set({ Rating_in:e.target.value })}
              style={{width:'100%',padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:8}}
            >
              <option value="">(vše)</option><option value="A">A</option><option value="B">B</option><option value="C">C</option>
            </select>
          </div>
          <div style={{gridColumn:'span 2'}}>
            <div style={{fontSize:12,color:'#6b7280'}}>Stav</div>
            <select
              value={filters.Stav_in || ''} onChange={(e)=>set({ Stav_in:e.target.value })}
              style={{width:'100%',padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:8}}
            >
              <option value="">(vše)</option>
              <option value="Aktuální">Aktuální</option>
              <option value="Nezajímavý">Nezajímavý</option>
            </select>
          </div>
          <div style={{gridColumn:'span 2'}}>
            <div style={{fontSize:12,color:'#6b7280'}}>Min 2025 (Kč)</div>
            <input type="number" value={filters.min_2025_kc ?? ''} onChange={(e)=>set({ min_2025_kc:e.target.value })}
              style={{width:'100%',padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:8}}/>
          </div>
          <div style={{gridColumn:'span 2'}}>
            <div style={{fontSize:12,color:'#6b7280'}}>Max 2025 (Kč)</div>
            <input type="number" value={filters.max_2025_kc ?? ''} onChange={(e)=>set({ max_2025_kc:e.target.value })}
              style={{width:'100%',padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:8}}/>
          </div>
          <div style={{gridColumn:'span 2'}}>
            <div style={{fontSize:12,color:'#6b7280'}}>Do naplánováno (dní)</div>
            <input type="number" value={filters.next_activity_days_max ?? ''} onChange={(e)=>set({ next_activity_days_max:e.target.value })}
              style={{width:'100%',padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:8}}/>
          </div>
          <div style={{gridColumn:'span 2'}}>
            <div style={{fontSize:12,color:'#6b7280'}}>Od poslední (dní)</div>
            <input type="number" value={filters.last_activity_days_max ?? ''} onChange={(e)=>set({ last_activity_days_max:e.target.value })}
              style={{width:'100%',padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:8}}/>
          </div>
          <div style={{gridColumn:'span 3',display:'flex',alignItems:'center',gap:14}}>
            <label style={{display:'flex',alignItems:'center',gap:8}}>
              <input type="checkbox" checked={filters.has_coords !== false} onChange={(e)=>set({ has_coords:e.target.checked })}/>
              <span style={{fontSize:13}}>Jen s GPS</span>
            </label>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <div style={{fontSize:12,color:'#6b7280'}}>Limit</div>
              <select value={filters.limit || 500} onChange={(e)=>set({ limit:Number(e.target.value) })}
                style={{padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:8}}>
                <option value={100}>100</option><option value={200}>200</option>
                <option value={500}>500</option><option value={1000}>1000</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
