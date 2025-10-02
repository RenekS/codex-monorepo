// src/ui/MarkerIcon.js

// --- pomocné funkce pro metriky ---
const toNum = (raw) => {
  if (raw === null || raw === undefined) return 0;
  const s = String(raw).replace(/\s/g, '').replace(/\./g, '').replace(/[^0-9,-]/g, '');
  if (!s) return 0;
  const v = parseFloat(s.replace(',', '.'));
  return isNaN(v) ? 0 : v;
};

const parseCzDate = (raw) => {
  if (!raw) return null;
  const m = String(raw).trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  const [, d, M, y, H='0', I='0'] = m;
  const dt = new Date(+y, +M-1, +d, +H, +I, 0, 0);
  return isNaN(dt.getTime()) ? null : dt;
};

const fmtCompact = (n) => {
  const v = Number(n)||0;
  if (Math.abs(v) >= 1_000_000) return (v/1_000_000).toFixed(Math.abs(v)>=10_000_000?0:1).replace('.', ',')+'M';
  if (Math.abs(v) >= 1_000)     return (v/1_000).toFixed(Math.abs(v)>=10_000?0:1).replace('.', ',')+'k';
  return String(Math.round(v));
};

// --- veřejné API ---
// 1) spočítá 4 hodnoty pro segmenty: [top, right, bottom, left]
export function getMetrics(k) {
  const vTop    = toNum(k['2025_Kc']);          // nahoře
  const vRight  = toNum(k['Rozjednáno za']);    // vpravo
  const last    = parseCzDate(k['Posledni_aktivita']);
  const next    = parseCzDate(k['Naplanovana_aktivita']);
  const now     = new Date();
  const vBottom = last ? Math.max(0, Math.round((now - last)/(1000*60*60*24))) : 0; // dny od poslední
  const vLeft   = next ? Math.max(0, Math.round((next - now)/(1000*60*60*24))) : 0; // dny do naplánované
  return [vTop, vRight, vBottom, vLeft];
}

// 2) vrátí HTML ikony s kruhem + názvem
export function circleWithValuesAndLabel(name, values, { size=56, strokeWidth=8, highlight=false } = {}) {
  const r = (size - strokeWidth)/2, cx=size/2, cy=size/2;
  const colors = ['#3b82f6','#10b981','#f59e0b','#ef4444'];
  const arc = (a1,a2) => {
    const t = d=>Math.PI/180*d, sx=cx+r*Math.cos(t(a1)), sy=cy+r*Math.sin(t(a1)), ex=cx+r*Math.cos(t(a2)), ey=cy+r*Math.sin(t(a2));
    return `M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`;
  };
  const pos = [
    {x:cx, y:cy-r*0.46},{x:cx+r*0.46,y:cy},{x:cx,y:cy+r*0.52},{x:cx-r*0.46,y:cy}
  ];
  const vals = values.map(fmtCompact);
  const maxLen = vals.reduce((m,s)=>Math.max(m,s.length),0);
  const fontSize = Math.max(9, Math.floor((size*(maxLen<=3?0.22:maxLen<=4?0.2:0.18))));
  const seg = [[-90,0],[0,90],[90,180],[180,270]].map(([a,b],i)=>(`
      <path d="${arc(a,b)}" fill="none" stroke="${colors[i]}" stroke-opacity="0.9"
            stroke-width="${strokeWidth}" stroke-linecap="round"/>
    `)).join('');
  const txt = vals.map((val,i)=>(`
      <text x="${pos[i].x}" y="${pos[i].y}" text-anchor="middle" alignment-baseline="middle"
            font-size="${fontSize}" font-weight="700" fill="#111"
            style="paint-order:stroke;stroke:#fff;stroke-width:2px;stroke-linejoin:round;">${val}</text>
    `)).join('');
  const label = String(name||'').trim();
  const trimmed = label.length>28?label.slice(0,27)+'…':label;

  return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:auto;">
      <div style="width:${size}px;height:${size}px;line-height:0;${highlight?'filter:drop-shadow(0 0 0.5rem rgba(59,130,246,0.6));':''}">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
          ${seg}
          <circle cx="${cx}" cy="${cy}" r="${Math.max(2, strokeWidth*0.55)}" fill="#fff" stroke="#e5e7eb" stroke-width="1"/>
          ${txt}
        </svg>
      </div>
      <div style="max-width:${Math.max(140,size*2)}px;padding:2px 6px;border-radius:8px;background:rgba(255,255,255,0.92);
        border:1px solid rgba(0,0,0,0.08);box-shadow:0 1px 3px rgba(0,0,0,0.12);font-size:12px;line-height:1.25;font-weight:600;
        color:#111;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${trimmed}</div>
    </div>
  `;
}
