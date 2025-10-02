import React, { useState, useEffect } from 'react';

export default function PlannerPanel({
  startTime, setStartTime,
  serviceMin, setServiceMin,
  selected, setSelected,
  onClear, onBuildRoute,
  gmapsLink, summary,
  onAiPlan,
  // nové pro start/cíl
  startPlace, setStartPlace, onGeocodeStart, geoStartBusy,
  endPlace, setEndPlace, onGeocodeEnd, geoEndBusy,
}) {
  // kolaps panelu (persist)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('km_planner_collapsed') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('km_planner_collapsed', collapsed ? '1' : '0'); } catch {}
  }, [collapsed]);

  const updateDesired = (idx, val) => {
    setSelected(prev => prev.map(x => x.idx === idx ? { ...x, desired: val } : x));
  };
  const updateDuration = (idx, val) => {
    const n = Math.max(0, Math.min(600, Number(val) || 0)); // 0..600 min
    setSelected(prev => prev.map(x => x.idx === idx ? { ...x, durationMin: n } : x));
  };

  return (
    <div style={{
      position:'absolute', top:8, left:8, zIndex:1000,
      background:'rgba(255,255,255,0.96)', backdropFilter:'blur(4px)',
      border:'1px solid rgba(0,0,0,0.08)', boxShadow:'0 6px 20px rgba(0,0,0,0.16)',
      borderRadius:12, padding:12, minWidth:320, maxWidth:460
    }}>
      {/* Header */}
      <div style={{display:'grid', gridTemplateColumns:'auto auto 1fr auto', gap:8, alignItems:'center', marginBottom:8}}>
        <div style={{fontWeight:800}}>Plánovač trasy</div>

        <button
          onClick={onClear}
          style={{border:'none',background:'#fee2e2',color:'#991b1b',padding:'6px 10px',borderRadius:8,cursor:'pointer',fontWeight:700}}
        >Vyčistit</button>

        <div style={{textAlign:'right'}}>
          <button
            onClick={()=>onBuildRoute(false)}
            style={{padding:'6px 10px',borderRadius:10,border:'none',background:'#111',color:'#fff',fontWeight:700,cursor:'pointer'}}
          >Trasa</button>
        </div>

        {/* Přepínač kolapsu */}
        <label style={{display:'inline-flex',alignItems:'center',gap:6,userSelect:'none',cursor:'pointer'}}>
          <input
            type="checkbox"
            checked={!collapsed}
            onChange={()=>setCollapsed(c => !c)}
            style={{accentColor:'#2563eb', width:16, height:16}}
          />
          <span style={{fontSize:13, color:'#111'}}>Plánovač</span>
        </label>
      </div>

      {/* Sbaleno? */}
      {collapsed ? null : (
        <>
          {/* Parametry */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:10}}>
            <div>
              <div style={{fontSize:12,color:'#6b7280'}}>Start</div>
              <input value={startTime} onChange={e=>setStartTime(e.target.value)} type="time"
                style={{width:'100%',padding:'6px 8px',border:'1px solid #e5e7eb',borderRadius:8}}/>
            </div>
            <div>
              <div style={{fontSize:12,color:'#6b7280'}}>Výchozí schůzka (min)</div>
              <input value={serviceMin} onChange={e=>setServiceMin(e.target.value)} type="number" min="0" max="600"
                style={{width:'100%',padding:'6px 8px',border:'1px solid #e5e7eb',borderRadius:8}}/>
            </div>
            <div style={{display:'flex',gap:6,alignItems:'flex-end',justifyContent:'flex-end'}}>
              <button
                onClick={()=>onBuildRoute(true)}
                style={{padding:'8px 10px',borderRadius:10,border:'none',background:'#2563eb',color:'#fff',fontWeight:700,cursor:'pointer'}}
              >Optimalizovat pořadí</button>
              <button
                onClick={() => { console.log('[PlannerPanel] AI click'); onAiPlan?.(); }}
                disabled={!onAiPlan || selected.length < 2}
                title="Návrh pořadí pomocí AI (respektuje desired časy)"
                style={{padding:'8px 10px',borderRadius:10,border:'1px solid #111',background:'#fff',color:'#111',fontWeight:700,cursor:'pointer'}}
              >AI navrhnout</button>
            </div>
          </div>

          {/* Start / Cíl (PSČ / adresa → GPS) */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
            <div>
              <div style={{fontSize:12,color:'#6b7280'}}>Vyjíždím z (PSČ/adresa)</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:6}}>
                <input value={startPlace} onChange={e=>setStartPlace(e.target.value)}
                  placeholder='např. 60200 nebo "Vídeňská 1, Brno"'
                  style={{width:'100%',padding:'6px 8px',border:'1px solid #e5e7eb',borderRadius:8}}/>
                <button onClick={onGeocodeStart} disabled={geoStartBusy}
                  style={{padding:'6px 10px',borderRadius:8,border:'1px solid #e5e7eb',background:'#fff',cursor:'pointer'}}>
                  {geoStartBusy ? '…' : '🔎'}
                </button>
              </div>
            </div>
            <div>
              <div style={{fontSize:12,color:'#6b7280'}}>Vracím se do (PSČ/adresa)</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:6}}>
                <input value={endPlace} onChange={e=>setEndPlace(e.target.value)}
                  placeholder='např. 60200 nebo "Vídeňská 1, Brno"'
                  style={{width:'100%',padding:'6px 8px',border:'1px solid #e5e7eb',borderRadius:8}}/>
                <button onClick={onGeocodeEnd} disabled={geoEndBusy}
                  style={{padding:'6px 10px',borderRadius:8,border:'1px solid #e5e7eb',background:'#fff',cursor:'pointer'}}>
                  {geoEndBusy ? '…' : '🔎'}
                </button>
              </div>
            </div>
          </div>

          {/* Seznam zastávek */}
          <div style={{maxHeight:260,overflow:'auto',border:'1px solid #eee',borderRadius:10,padding:6}}>
            {selected.length===0 ? (
              <div style={{color:'#6b7280',fontSize:13}}>
                Tip: podrž <b>Shift</b> a klikej na body, nebo v popupu zvol „Přidat do trasy“.
              </div>
            ) : selected.map((p,i)=>(
              <div key={p.idx} style={{
                display:'grid',
                gridTemplateColumns:'22px 1fr 92px 88px auto',
                columnGap:6, alignItems:'center', padding:'4px 2px'
              }}>
                <div style={{width:18,height:18,borderRadius:999,background:'#111',color:'#fff',
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800}}>{i+1}</div>

                <div title={p.name} style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontWeight:600}}>
                  {p.name}
                </div>

                {/* desired time */}
                <input
                  type="time"
                  value={p.desired || ''}
                  onChange={(e)=>updateDesired(p.idx, e.target.value)}
                  title="Chci být v tento čas"
                  style={{width:'100%',padding:'4px 6px',border:'1px solid #e5e7eb',borderRadius:8}}
                />

                {/* duration per stop */}
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:12,color:'#6b7280'}}>⏱</span>
                  <input
                    type="number" min="0" max="600"
                    value={p.durationMin ?? ''}
                    placeholder={String(serviceMin ?? 0)}
                    onChange={(e)=>updateDuration(p.idx, e.target.value)}
                    title="Délka schůzky (min)"
                    style={{width:64,padding:'4px 6px',border:'1px solid #e5e7eb',borderRadius:8}}
                  />
                </div>

                {/* ETA / odjezd */}
                <div style={{textAlign:'right',fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'}}>
                  {summary?.etas?.[i]
                    ? <>
                        ETA {summary.etas[i].toLocaleTimeString('cs-CZ',{hour:'2-digit',minute:'2-digit'})}
                        {summary.etds?.[i] &&
                          <span style={{color:'#6b7280'}}> → {summary.etds[i].toLocaleTimeString('cs-CZ',{hour:'2-digit',minute:'2-digit'})}</span>}
                        {summary.late?.[i] && <span style={{color:'#dc2626',fontWeight:700,marginLeft:6}}>✖ pozdě</span>}
                        {summary.wait?.[i] && !summary.late?.[i] && <span style={{color:'#6b7280',marginLeft:6}}>… čekání</span>}
                      </>
                    : <span style={{color:'#9ca3af'}}>—</span>}
                </div>
              </div>
            ))}
          </div>

          {/* souhrn a link */}
          {summary && (
            <div style={{marginTop:10,fontSize:13,display:'grid',gap:6}}>
              <div>
                <b>Vzdálenost:</b> {summary.distanceKm.toLocaleString('cs-CZ')} km
                &nbsp;•&nbsp; <b>Čistý čas jízdy:</b> {summary.durationMin} min
              </div>
              {gmapsLink && (
                <a href={gmapsLink} target="_blank" rel="noopener"
                  style={{marginTop:4,display:'inline-block',background:'#10b981',color:'#fff',
                    padding:'8px 10px',borderRadius:10,textDecoration:'none',fontWeight:800,textAlign:'center'}}>
                  Otevřít trasu v Google Maps
                </a>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
