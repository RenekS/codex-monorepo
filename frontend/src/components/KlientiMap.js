import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import axios from 'axios';

import PlannerPanel from './PlannerPanel';
import FilterBar from './FilterBar';
import usePlanner from '../hooks/usePlanner';
import useDebounce from '../hooks/useDebounce';
import useAiPlan from '../hooks/useAiPlan';
import { makeClusterIconFactory } from '../ui/ClusterIcon';
import { circleWithValuesAndLabel, getMetrics } from '../ui/MarkerIcon';
import { geocodeOne } from '../services/geocode';

const KlientiMap = () => {
  const mapRef = useRef(null);
  const clusterLayerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const startMarkerRef = useRef(null);
  const endMarkerRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [ownerOptions, setOwnerOptions] = useState([]);
  const [bbox, setBbox] = useState(null);

  // --- viditelnost plánovače (persist) ---
  const [plannerVisible, setPlannerVisible] = useState(() => {
    try { return localStorage.getItem('km_planner_visible') !== '0'; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem('km_planner_visible', plannerVisible ? '1' : '0'); } catch {}
  }, [plannerVisible]);

  // --- režim optimalizace (persist) ---
  const [optMode, setOptMode] = useState(() => {
    try { return localStorage.getItem('km_opt_mode') || 'distance'; } catch { return 'distance'; }
  });
  useEffect(() => {
    try { localStorage.setItem('km_opt_mode', optMode); } catch {}
  }, [optMode]);

  // --- start režim + custom souřadnice + GPS status (persist pro režim a custom coords) ---
  const [startMode, setStartMode] = useState(() => {
    try { return localStorage.getItem('km_start_mode') || 'first'; } catch { return 'first'; }
  });
  useEffect(() => {
    try { localStorage.setItem('km_start_mode', startMode); } catch {}
  }, [startMode]);

  const [customStart, setCustomStart] = useState(() => {
    try {
      return {
        lat: localStorage.getItem('km_start_lat') || '',
        lng: localStorage.getItem('km_start_lng') || ''
      };
    } catch {
      return { lat: '', lng: '' };
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('km_start_lat', customStart.lat || '');
      localStorage.setItem('km_start_lng', customStart.lng || '');
    } catch {}
  }, [customStart]);

  const [gpsCoord, setGpsCoord] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('');
  const onRequestGPS = () => {
    if (!navigator.geolocation) { setGpsStatus('Geolokace není podporována'); return; }
    setGpsStatus('Zjišťuji polohu…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoord({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus(`OK (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
      },
      (err) => { setGpsStatus('Nelze získat GPS'); console.error(err); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // --- Start/Cíl přes PSČ/adresu ---
  const [startPlace, setStartPlace] = useState('');
  const [endPlace, setEndPlace] = useState('');
  const [startCoord, setStartCoord] = useState(null);
  const [endCoord, setEndCoord] = useState(null);
  const [geoBusy, setGeoBusy] = useState({ start:false, end:false });

  const updateStartEndMarkers = () => {
    if (!mapRef.current) return;
    // start
    if (startMarkerRef.current) { startMarkerRef.current.remove(); startMarkerRef.current = null; }
    if (startCoord) {
      startMarkerRef.current = L.circleMarker([startCoord.lat, startCoord.lng], { radius: 7, color: '#16a34a', weight: 3, fillOpacity: 0.2 }).addTo(mapRef.current);
      startMarkerRef.current.bindTooltip('Start', { permanent:false });
    }
    // end
    if (endMarkerRef.current) { endMarkerRef.current.remove(); endMarkerRef.current = null; }
    if (endCoord) {
      endMarkerRef.current = L.circleMarker([endCoord.lat, endCoord.lng], { radius: 7, color: '#111827', weight: 3, fillOpacity: 0.2 }).addTo(mapRef.current);
      endMarkerRef.current.bindTooltip('Cíl', { permanent:false });
    }
  };

  useEffect(() => { updateStartEndMarkers(); /* eslint-disable-next-line */ }, [startCoord, endCoord]);

  const onGeocodeStart = async () => {
    if (!startPlace.trim()) { setStartCoord(null); return; }
    try {
      setGeoBusy(s => ({...s, start:true}));
      const b = mapRef.current?.getBounds?.();
      const bboxStr = b ? `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}` : undefined;
      const hit = await geocodeOne(startPlace.trim(), { bbox: bboxStr, country: 'cz', language: 'cs' });
      setStartCoord(hit ? { lat: hit.lat, lng: hit.lng } : null);
    } finally {
      setGeoBusy(s => ({...s, start:false}));
    }
  };

  const onGeocodeEnd = async () => {
    if (!endPlace.trim()) { setEndCoord(null); return; }
    try {
      setGeoBusy(s => ({...s, end:true}));
      const b = mapRef.current?.getBounds?.();
      const bboxStr = b ? `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}` : undefined;
      const hit = await geocodeOne(endPlace.trim(), { bbox: bboxStr, country: 'cz', language: 'cs' });
      setEndCoord(hit ? { lat: hit.lat, lng: hit.lng } : null);
    } finally {
      setGeoBusy(s => ({...s, end:false}));
    }
  };

  // --- Filtry (client -> server params + debounce) ---
  const [filters, setFilters] = useState({
    has_coords: true, limit: 500, q: '', PSC_like: '',
    Vlastnik_in: [], Rating_in: '', Stav_in: '',
    min_2025_kc: '', max_2025_kc: '',
    next_activity_days_max: '', last_activity_days_max: '',
  });
  const debouncedFilters = useDebounce(filters, 400);

  // --- Plánovač (OSRM v hooku) ---
  const {
    selected, setSelected,
    startTime, setStartTime,
    serviceMin, setServiceMin,
    summary, gmapsLink,
    resetSummary, clearAll, plan, reorderSelectedToOrdered,
  } = usePlanner();

  const { planWithAI } = useAiPlan();

  const parseLat = v => parseFloat(String(v).replace(/,/g, '.'));
  const parseLng = v => parseFloat(String(v).replace(/,/g, '.'));

  const rebuildMarkerIcon = (marker, k, highlight = false) => {
    const metrics = getMetrics(k);
    const html = circleWithValuesAndLabel(k.Nazev_jmeno, metrics, { size: 56, strokeWidth: 8, highlight });
    marker.setIcon(L.divIcon({ html, className: '', iconSize: [1, 1], popupAnchor: [0, -30] }));
  };

  // Init mapy + bbox listener
  useEffect(() => {
    if (mapRef.current) return;
    mapRef.current = L.map('klienti-map', { center: [49.1951, 16.6068], zoom: 7 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM contributors' }).addTo(mapRef.current);
    clusterLayerRef.current = L.markerClusterGroup({ iconCreateFunction: makeClusterIconFactory({ size: 40 }) });
    routeLayerRef.current = L.layerGroup().addTo(mapRef.current);
    mapRef.current.addLayer(clusterLayerRef.current);

    const updateBbox = () => {
      const b = mapRef.current.getBounds();
      setBbox(`${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`);
    };
    updateBbox();
    mapRef.current.on('moveend', updateBbox);
  }, []);

  // Načtení klientů
  useEffect(() => {
    if (!bbox) return;
    setLoading(true);

    const params = { ...debouncedFilters, bbox };
    // multi-owner -> "a,b,c"
    if (Array.isArray(params.Vlastnik_in)) {
      if (params.Vlastnik_in.length) params.Vlastnik_in = params.Vlastnik_in.join(',');
      else delete params.Vlastnik_in;
    }
    // remove empty
    Object.keys(params).forEach(k => {
      if (params[k] === '' || params[k] === null || params[k] === undefined) delete params[k];
    });

    axios.get(`${process.env.REACT_APP_API_URL}/klienti`, { params })
      .then(res => {
        const rows = (res.data?.data || []).filter(x => x.Zemepisna_sirka && x.Zemepisna_delka);
        setClients(rows);
        const owners = Array.from(new Set(rows.map(r => String(r.Vlastnik || '').trim()).filter(Boolean)))
          .sort((a, b) => a.localeCompare(b, 'cs'));
        setOwnerOptions(owners);
      })
      .catch(err => console.error('Chyba načtení:', err))
      .finally(() => setLoading(false));
  }, [debouncedFilters, bbox]);

  const clearRouteLayer = () => { if (routeLayerRef.current) routeLayerRef.current.clearLayers(); };

  const drawRoute = (route) => {
    clearRouteLayer();
    if (!route) return;
    const gj = L.geoJSON(route.geometry, { style: { weight: 5, opacity: 0.9 } });
    gj.addTo(routeLayerRef.current);
    mapRef.current.fitBounds(gj.getBounds(), { padding: [40, 40] });
  };

  // Markery
  useEffect(() => {
    if (!clusterLayerRef.current) return;
    clusterLayerRef.current.clearLayers();

    clients.forEach((k, idx) => {
      const lat = parseLat(k.Zemepisna_sirka);
      const lng = parseLng(k.Zemepisna_delka);
      if (isNaN(lat) || isNaN(lng)) return;

      const marker = L.marker([lat, lng], { clientData: { ...k, _idx: idx } });
      const isSel = selected.some(s => s.idx === idx);
      rebuildMarkerIcon(marker, k, isSel);

      marker.on('click', (e) => {
        const shift = e.originalEvent && e.originalEvent.shiftKey;
        if (shift) {
          setSelected(prev => {
            const exists = prev.find(p => p.idx === idx);
            let next;
            if (exists) { next = prev.filter(p => p.idx !== idx); rebuildMarkerIcon(marker, k, false); }
            else { next = [...prev, { idx, lat, lng, name: k.Nazev_jmeno || `#${idx + 1}`, desired: '', durationMin: Number(serviceMin) || 0, svc: '' }]; rebuildMarkerIcon(marker, k, true); }
            clearRouteLayer(); resetSummary(); return next;
          });
          return;
        }
        const metrics = getMetrics(k);
        const big = circleWithValuesAndLabel(k.Nazev_jmeno, metrics, { size: 110, strokeWidth: 12, highlight: isSel });
        const addr = [k.Ulice_kontaktni, k.Mesto_kontaktni, k.PSC_kontaktni].filter(Boolean).join(', ');
        const www = (k.WWW || '').replace(/^https?:\/\//, '');
        const content = `
          <div style="min-width:260px;max-width:360px;display:flex;flex-direction:column;gap:10px;font-size:14px;line-height:1.35;">
            <div style="display:flex;gap:12px;align-items:center;justify-content:space-between;">
              <div style="font-weight:800;font-size:16px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${k.Nazev_jmeno || ''}</div>
              <div style="font-size:12px;padding:2px 6px;border-radius:999px;background:#eef2ff;border:1px solid #e5e7eb;">${k.Rating || ''}</div>
            </div>
            <div>${big}</div>
            <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 10px;">
              <div style="color:#6b7280;">Stav</div><div>${k.Stav || '—'}</div>
              <div style="color:#6b7280;">Vztah</div><div>${k.Vztah || '—'}</div>
              <div style="color:#6b7280;">Vlastník</div><div>${k.Vlastnik || '—'}</div>
              <div style="color:#6b7280;">Adresa</div><div>${addr || '—'}</div>
              <div style="color:#6b7280;">Tel</div><div>${(k.Tel1 || k.Tel2 || '').trim() || '—'}</div>
              <div style="color:#6b7280;">Web</div><div>${www ? `<a href="https://${www}" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:none;">${www}</a>` : '—'}</div>
            </div>
            <div style="display:flex;gap:8px;justify-content:space-between;">
              <button data-action="toggle" style="padding:8px 10px;border-radius:10px;background:${isSel ? '#dc2626' : '#111'};color:#fff;font-weight:700;border:none;cursor:pointer;">
                ${isSel ? 'Odebrat z trasy' : 'Přidat do trasy'}
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
            setSelected(prev => {
              const exists = prev.find(p => p.idx === idx);
              let next;
              if (exists) { next = prev.filter(p => p.idx !== idx); rebuildMarkerIcon(marker, k, false); }
              else { next = [...prev, { idx, lat, lng, name: k.Nazev_jmeno || `#${idx + 1}`, desired: '', durationMin: Number(serviceMin) || 0,  svc: '' }]; rebuildMarkerIcon(marker, k, true); }
              clearRouteLayer(); resetSummary(); return next;
            });
            marker.closePopup();
          }
        }, { once: true });
      });

      clusterLayerRef.current.addLayer(marker);
    });
  }, [clients, selected, resetSummary, setSelected, serviceMin]);

  // start bod pro plánování podle původního režimu (GPS/custom) – fallback pokud není geokódovaný start
  const buildStartOverride = () => {
    if (startMode === 'gps' && gpsCoord) return { ...gpsCoord, name: 'Start (GPS)' };
    if (startMode === 'custom') {
      const lat = parseFloat(String(customStart.lat).replace(/,/g, '.'));
      const lng = parseFloat(String(customStart.lng).replace(/,/g, '.'));
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng, name: 'Start' };
    }
    return null; // 'first' nebo nevalidní souřadnice
  };

  // Akce plánovače
  const onBuildRoute = async () => {
    if (selected.length < 1) return;
    const startFallback = buildStartOverride();
    const sc = startCoord || startFallback || null;
    const { route, ordered } = await plan(selected, optMode, { startCoord: sc, endCoord });
    drawRoute(route);
    if (ordered) setSelected(reorderSelectedToOrdered(selected, ordered));
  };

  const onAiPlan = async () => {
    try {
      if (selected.length < 2) return;
      const ai = await planWithAI({ selected, startTime, serviceMin, workWindow: null });
      if (Array.isArray(ai.order) && ai.order.length >= 2) {
        const ordered = ai.order.map(i => selected[i]).filter(Boolean);
        setSelected(ordered);
        const startFallback = buildStartOverride();
        const sc = startCoord || startFallback || null;
        const { route } = await plan(ordered, false, { startCoord: sc, endCoord });
        drawRoute(route);
      }
    } catch (e) {
      console.error('AI plán selhal:', e);
      const startFallback = buildStartOverride();
      const sc = startCoord || startFallback || null;
      const { route, ordered } = await plan(selected, true, { startCoord: sc, endCoord });
      drawRoute(route);
      if (ordered) setSelected(reorderSelectedToOrdered(selected, ordered));
    }
  };

  const onClear = () => { clearAll(); clearRouteLayer(); };

  const onResetFilters = () => setFilters({
    has_coords: true, limit: 500, q: '', PSC_like: '',
    Vlastnik_in: [], Rating_in: '', Stav_in: '',
    min_2025_kc: '', max_2025_kc: '',
    next_activity_days_max: '', last_activity_days_max: '',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Horní lišta s filtry */}
      <div style={{ padding: '10px 12px' }}>
        <FilterBar
          filters={filters} setFilters={setFilters} onReset={onResetFilters}
          ownerOptions={ownerOptions}
          plannerVisible={plannerVisible} setPlannerVisible={setPlannerVisible}
          // (necháváme původní volby)
        />
      </div>

      {/* Mapa + Plánovač */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <div id="klienti-map" style={{ height: '100%', width: '100%' }} />
        {plannerVisible && (
          <PlannerPanel
            // plánovací stav
            startTime={startTime} setStartTime={setStartTime}
            serviceMin={serviceMin} setServiceMin={setServiceMin}
            selected={selected} setSelected={setSelected}
            onClear={onClear} onBuildRoute={onBuildRoute}
            gmapsLink={gmapsLink} summary={summary}
            onAiPlan={onAiPlan}
            // nové: start/cíl přes PSČ/adresu
            startPlace={startPlace} setStartPlace={setStartPlace}
            onGeocodeStart={onGeocodeStart} geoStartBusy={geoBusy.start}
            endPlace={endPlace} setEndPlace={setEndPlace}
            onGeocodeEnd={onGeocodeEnd} geoEndBusy={geoBusy.end}
            // původní GPS/custom režimy (zůstávají pro fallback)
            optMode={optMode} setOptMode={setOptMode}
            startMode={startMode} setStartMode={setStartMode}
            customStart={customStart} setCustomStart={setCustomStart}
            onRequestGPS={onRequestGPS} gpsStatus={gpsStatus}
          />
        )}
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.6)' }}>
            Načítám...
          </div>
        )}
      </div>
    </div>
  );
};

export default KlientiMap;
