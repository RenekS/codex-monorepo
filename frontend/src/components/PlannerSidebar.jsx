import React from 'react';

export default function PlannerSidebar({
  stops, startHHMM, defaultServiceMin,
  onStartChange, onDefaultServiceChange,
  onStopChange, onRemoveStop,
  onBuild, onOptimize, onClear, summary, gmapsLink
}) {
  return (
    <div style={{
      position:'absolute', top:8, left:8, zIndex:1000,
      background:'rgba(255,255,255,0.96)', backdropFilter:'blur(4px)',
      border:'1px solid rgba(0,0,0,0.08)', boxShadow:'0 6px 20px rgba(0,0,0,0.16)',
      borderRadius:12, padding:12, minWidth:300, maxWidth:380
    }}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <div style={{fontWeight:800}}>Plánovač trasy</div>
        <button onClick={onClear} style={{border:'none',background:'#fee2e2',color:'#991b1b',padding:'6px 8px',borderRadius:8,cursor:'pointer',fontWeight:700}}>
          Vyčistit
        </button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:10}}>
        <div>
          <div style={{fontSize:12,color:'#6b7280'}}>Start</div>
          <input value={startHHMM} onChange={e=>onStartChange(e.target.value)} type="time"
            style={{width:'100%',padding:'6px 8px',border:'1px solid #e5e7eb',borderRadius:8}}/>
        </div>
        <div>
          <div style={{fontSize:12,color:'#6b7280'}}>Default servis (min)</div>
          <input value={defaultServiceMin} onChange={e=>onDefaultServiceChange(Number(e.target.value)||0)} type="number" min="0"
            style={{width:'100%',padding:'6px 8px',border:'1px solid #e5e7eb',borderRadius:8}}/>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'flex-end',justifyContent:'flex-end'}}>
          <button onClick={onBuild} style={{padding:'8px 10px',borderRadius:10,border:'none',background:'#111',color:'#fff',fontWeight:700,cursor:'pointer'}}>Trasa</button>
          <button onClick={onOptimize} style={{padding:'8px 10px',borderRadius:10,border:'none',background:'#2563eb',color:'#fff',fontWeight:700,cursor:'pointer'}}>Optimalizovat</button>
        </div>
      </div>

      <div style={{maxHeight:240,overflow:'auto',border:'1px solid #eee',borderRadius:10,padding:6}}>
        {stops.length===0 ? (
          <div style={{color:'#6b7280',fontSize:13}}>Tip: podrž <b>Shift</b> a klikej na body v mapě, nebo zvol „Přidat do trasy“ v popupu.</div>
        ) : stops.map((p,i)=>(
          <div key={p.id} style={{display:'grid',gridTemplateColumns:'22px 1fr 84px 92px 24px',gap:6,alignItems:'center',padding:'4px 2px'}}>
            <div style={{width:18,height:18,borderRadius:999,background:'#111',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800}}>{i+1}</div>
            <div title={p.name} style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontWeight:600}}>{p.name}</div>
            <input type="time" value={p.desiredHHMM||''}
              onChange={(e)=>onStopChange(p.id, { desiredHHMM: e.target.value })}
              style={{width:'100%',padding:'4px 6px',border:'1px solid #e5e7eb',borderRadius:8}}/>
            <input type="number" min="0" value={p.serviceMin ?? ''}
              placeholder={String(defaultServiceMin)}
              onChange={(e)=>onStopChange(p.id, { serviceMin: e.target.value===''? null : Number(e.target.value)||0 })}
              style={{width:'100%',padding:'4px 6px',border:'1px solid #e5e7eb',borderRadius:8}}/>
            <button onClick={()=>onRemoveStop(p.id)} title="Odebrat"
              style={{border:'none',background:'#fee2e2',color:'#991b1b',borderRadius:8,width:24,height:24,cursor:'pointer',fontWeight:800}}>×</button>
          </div>
        ))}
      </div>

      {summary && (
        <div style={{marginTop:10,fontSize:13,display:'grid',gap:6}}>
          <div><b>Vzdálenost:</b> {summary.distanceKm.toLocaleString('cs-CZ')} km &nbsp;•&nbsp; <b>Čas jízdy:</b> {summary.durationMin} min</div>
          <div style={{borderTop:'1px dashed #ddd',paddingTop:6}}>
            {stops.map((p,i)=>(
              <div key={p.id} style={{display:'grid',gridTemplateColumns:'26px 1fr auto',gap:8,alignItems:'center'}}>
                <div style={{textAlign:'center',fontWeight:800}}>{i+1}</div>
                <div title={p.name} style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}</div>
                <div style={{fontVariantNumeric:'tabular-nums'}}>
                  ETA {summary.etas[i].toLocaleTimeString('cs-CZ',{hour:'2-digit',minute:'2-digit'})}
                </div>
              </div>
            ))}
          </div>
          {gmapsLink && (
            <a href={gmapsLink} target="_blank" rel="noopener" style={{marginTop:4,display:'inline-block',background:'#10b981',color:'#fff',padding:'8px 10px',borderRadius:10,textDecoration:'none',fontWeight:800,textAlign:'center'}}>
              Otevřít trasu v Google Maps
            </a>
          )}
        </div>
      )}
    </div>
  );
}
