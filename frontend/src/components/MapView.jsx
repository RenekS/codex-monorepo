import React, { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { circleWithValuesAndLabel } from '../ui/MarkerIcon';

// --------- metriky do kruhu ----------
const toNum = (raw) => {
  if (raw === null || raw === undefined) return 0;
  const s = String(raw).replace(/\s/g,'').replace(/\./g,'').replace(/[^0-9,-]/g,'');
  if (!s) return 0;
  return parseFloat(s.replace(',', '.')) || 0;
};
const parseCzDate = (raw) => {
  if (!raw) return null;
  const m = String(raw).trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  const [, d, M, y, H='0', I='0'] = m;
  const dt = new Date(+y, +M-1, +d, +H, +I, 0, 0);
  return isNaN(dt.getTime()) ? null : dt;
};
function getMetrics(k) {
  const top    = toNum(k['2025_Kc']);           // nahoře
  const right  = toNum(k['Rozjednáno za']);     // vpravo
  const last   = parseCzDate(k['Posledni_aktivita']);
  const next   = parseCzDate(k['Naplanovana_aktivita']);
  const now    = new Date();
  const bottom = last ? Math.max(0, Math.round((now - last)/(1000*60*60*24))) : 0;
  const left   = next ? Math.max(0, Math.round((next - now)/(1000*60*60*24))) : 0;
  return [top, right, bottom, left];
}

// --------- robustní čtení GPS ----------
const parseNum = (v) => {
  if (v === null || v === undefined) return NaN;
  const s = String(v).trim().replace(/,/g,'.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
};
// najdi hodnotu podle přesných i „fuzzy“ názvů
function pickField(obj, candidates) {
  if (!obj) return undefined;
  // přesné
  for (const k of candidates) if (obj[k] != null && obj[k] !== '') return obj[k];
  // fuzzy (mezery/diakritika/case)
  const keys = Object.keys(obj);
  const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\s/g,'');
  const normMap = new Map(keys.map(k => [norm(k), k]));
  for (const wanted of candidates.map(norm)) {
    const hit = normMap.get(wanted);
    if (hit && obj[hit] != null && obj[hit] !== '') return obj[hit];
  }
  // fallback: cokoliv s „zemepisna“ & „sirka/delka“
  const has = (k, sub) => norm(k).includes(sub);
  const latKey = keys.find(k => has(k,'zemepisna') && has(k,'sirka'));
  const lngKey = keys.find(k => has(k,'zemepisna') && (has(k,'delka') || has(k,'delka')));
  if (latKey && lngKey && obj[latKey] != null && obj[lngKey] != null) {
    return { __pair__: [obj[latKey], obj[lngKey]] };
  }
  return undefined;
}
function getLatLng(k) {
  // kontakt
  let latRaw = pickField(k, ['Zemepisna_sirka']);
  let lngRaw = pickField(k, ['Zemepisna_delka']);
  // fallback sídlo
  if (latRaw === undefined || lngRaw === undefined || latRaw === '' || lngRaw === '') {
    latRaw = pickField(k, ['Zemepisna_sirka_sidlo']);
    lngRaw = pickField(k, ['Zemepisna_delka_sidlo']);
  }
  // z fuzzy páru
  if (latRaw && typeof latRaw === 'object' && latRaw.__pair__) {
    const [latR, lngR] = latRaw.__pair__;
    const lat = parseNum(latR), lng = parseNum(lngR);
    return (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng } : null;
  }
  const lat = parseNum(latRaw), lng = parseNum(lngRaw);
  return (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng } : null;
}

// --------- komponenta ----------
export default function MapView({ clients, selectedIds, onToggleSelect, routeGeoJSON }) {
  const outerRef = useRef(null);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const clusterRef = useRef(null);
  const routeLayerRef = useRef(null);

  const points = useMemo(() => {
    const arr = [];
    (clients || []).forEach((k, idx) => {
      const p = getLatLng(k);
      if (p) arr.push({ idx, k, ...p });
    });
    return arr;
  }, [clients]);

  const hasPoints = points.length > 0;

  // init mapy
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { center:[49.1951,16.6068], zoom:7 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:'&copy; OSM contributors'
    }).addTo(map);

    const cluster = L.markerClusterGroup({
      iconCreateFunction: cluster => {
        const markers = cluster.getAllChildMarkers();
        const totals = markers.length;
        const size=40, r=size/2, colors=['#3b82f6','#10b981','#f59e0b','#ef4444'];
        const paths=[0,1,2,3].map(i=>{
          const a=i*90*Math.PI/180, b=(i+1)*90*Math.PI/180;
          const sx=r+r*Math.cos(a), sy=r+r*Math.sin(a), ex=r+r*Math.cos(b), ey=r+r*Math.sin(b);
          return `<path d="M${r},${r} L${sx},${sy} A${r},${r} 0 0,1 ${ex},${ey} Z" fill="${colors[i]}" fill-opacity="0.6"/>`;
        }).join('');
        const html=`<div style="display:inline-block;width:${size}px;height:${size}px;line-height:0;">
          <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${paths}
            <circle cx="${r}" cy="${r}" r="${r/2}" fill="white"/><text x="${r}" y="${r+4}" text-anchor="middle" font-size="12" font-weight="bold">${totals}</text>
          </svg></div>`;
        return L.divIcon({ html, className:'', iconSize:[size,size] });
      }
    });

    const routeLayer = L.layerGroup().addTo(map);
    map.addLayer(cluster);

    mapRef.current = map;
    clusterRef.current = cluster;
    routeLayerRef.current = routeLayer;

    const invalidate = () => map.invalidateSize();
    const t = setTimeout(invalidate, 0);
    window.addEventListener('resize', invalidate);

    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', invalidate);
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
      routeLayerRef.current = null;
    };
  }, []);

  // markery
  useEffect(() => {
    if (!clusterRef.current || !mapRef.current) return;
    const cluster = clusterRef.current;
    cluster.clearLayers();

    const layerMarkers = [];

    points.forEach(({ idx, k, lat, lng }) => {
      const highlight = selectedIds?.includes(idx);
      const html = circleWithValuesAndLabel(k.Nazev_jmeno, getMetrics(k), { size:56, strokeWidth:8, highlight });

      const marker = L.marker([lat, lng], {
        clientData: { ...k, _idx: idx },
        icon: L.divIcon({ html, className:'', iconSize:[1,1], popupAnchor:[0,-30] })
      });

      marker.on('click', (e) => {
        const shift = e.originalEvent && e.originalEvent.shiftKey;
        if (shift) {
          onToggleSelect?.({ id: idx, lat, lng, name: k.Nazev_jmeno || `#${idx+1}` });
          return;
        }

        const big = circleWithValuesAndLabel(k.Nazev_jmeno, getMetrics(k), { size:110, strokeWidth:12, highlight });
        const addr = [k.Ulice_kontaktni, k.Mesto_kontaktni, k.PSC_kontaktni].filter(Boolean).join(', ');
        const www  = (k.WWW||'').replace(/^https?:\/\//,'');
        const content = `
          <div style="min-width:260px;max-width:360px;display:flex;flex-direction:column;gap:10px;font-size:14px;line-height:1.35;">
            <div style="display:flex;gap:12px;align-items:center;justify-content:space-between;">
              <div style="font-weight:800;font-size:16px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${k.Nazev_jmeno||''}</div>
              <div style="font-size:12px;padding:2px 6px;border-radius:999px;background:#eef2ff;border:1px solid #e5e7eb;">${k.Rating||''}</div>
            </div>
            <div>${big}</div>
            <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 10px;">
              <div style="color:#6b7280;">Stav</div><div>${k.Stav||'—'}</div>
              <div style="color:#6b7280;">Vztah</div><div>${k.Vztah||'—'}</div>
              <div style="color:#6b7280;">Vlastník</div><div>${k.Vlastnik||'—'}</div>
              <div style="color:#6b7280;">Adresa</div><div>${addr||'—'}</div>
              <div style="color:#6b7280;">Web</div><div>${www?`<a href="https://${www}" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:none;">${www}</a>`:'—'}</div>
            </div>
            <div style="display:flex;gap:8px;justify-content:space-between;">
              <button data-action="toggle"
                style="padding:8px 10px;border-radius:10px;background:${highlight?'#dc2626':'#111'};color:#fff;font-weight:700;border:none;cursor:pointer;">
                ${highlight?'Odebrat z trasy':'Přidat do trasy'}
              </button>
              <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener"
                 style="display:inline-flex;align-items:center;gap:6px;padding:8px 10px;border-radius:10px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;">
                 Otevřít v Mapách
              </a>
            </div>
          </div>`;

        marker.bindPopup(content, { maxWidth: 380, closeButton: true }).openPopup();
        marker.getPopup().getElement().addEventListener('click', (ev) => {
          const t = ev.target;
          if (t && t.getAttribute('data-action') === 'toggle') {
            onToggleSelect?.({ id: idx, lat, lng, name: k.Nazev_jmeno || `#${idx+1}` });
            marker.closePopup();
          }
        }, { once:true });
      });

      layerMarkers.push(marker);
      cluster.addLayer(marker);
    });

    if (layerMarkers.length) {
      const group = L.featureGroup(layerMarkers);
      try { mapRef.current.fitBounds(group.getBounds(), { padding:[40,40] }); } catch {}
    }
  }, [points, selectedIds, onToggleSelect]);

  // trasa
  useEffect(() => {
    if (!routeLayerRef.current) return;
    const layer = routeLayerRef.current;
    layer.clearLayers();
    if (routeGeoJSON) {
      const gj = L.geoJSON(routeGeoJSON, { style: { weight: 5, opacity: 0.9 } });
      gj.addTo(layer);
      try { mapRef.current.fitBounds(gj.getBounds(), { padding:[40,40] }); } catch {}
    }
  }, [routeGeoJSON]);

  return (
    <div ref={outerRef} style={{ position:'relative', height:'100%', width:'100%' }}>
      <div ref={containerRef} style={{ height:'100%', width:'100%' }} />
      {clients?.length > 0 && !hasPoints && (
        <div style={{
          position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
          background:'rgba(255,255,255,0.85)', zIndex: 500
        }}>
          <div style={{ textAlign:'center', color:'#6b7280' }}>
            <div style={{ fontWeight:800, marginBottom:6 }}>No GPS data available</div>
            <div style={{ fontSize:13 }}>
              V datech se nenašel žádný použitelný pár (lat,lng). Zkontroluj názvy/obsah GPS polí.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
