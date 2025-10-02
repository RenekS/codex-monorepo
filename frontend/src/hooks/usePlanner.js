import { useState, useCallback, useMemo } from 'react';
import axios from 'axios';

const OSRM = 'https://router.project-osrm.org';

// utils
const coordsStr = (arr) => arr.map(p => `${p.lng},${p.lat}`).join(';');

const hhmmToDate = (hhmm) => {
  const [h = '8', m = '0'] = String(hhmm || '').split(':');
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), +h, +m, 0, 0);
};

const fetchRoute = async (orderedPoints, startCoord = null, endCoord = null) => {
  const seq = [
    ...(startCoord ? [startCoord] : []),
    ...(orderedPoints || []),
    ...(endCoord ? [endCoord] : []),
  ];
  if (!seq || seq.length < 2) return null;
  const url = `${OSRM}/route/v1/driving/${coordsStr(seq)}?overview=full&geometries=geojson&steps=false`;
  const res = await axios.get(url);
  return res.data?.routes?.[0] || null;
};

const fetchMatrix = async (points) => {
  const url = `${OSRM}/table/v1/driving/${coordsStr(points)}?annotations=duration`;
  const res = await axios.get(url);
  return res.data?.durations || null; // NxN (s)
};

const nearestNeighborOrder = async (points) => {
  if (points.length <= 2) return points;
  const durations = await fetchMatrix(points);
  if (!durations) return points;
  const n = points.length;
  const used = Array(n).fill(false);
  const order = [0]; // začni 1. bodem
  used[0] = true;
  for (let step = 1; step < n; step++) {
    const last = order[order.length - 1];
    let best = -1, bestCost = Infinity;
    for (let j = 0; j < n; j++) {
      if (!used[j] && durations[last][j] < bestCost) { bestCost = durations[last][j]; best = j; }
    }
    used[best] = true;
    order.push(best);
  }
  return order.map(i => points[i]);
};

// --- hlavní hook ---
export default function usePlanner() {
  const [selected, setSelected] = useState([]); // [{idx,lat,lng,name,desired?,durationMin?}]
  const [startTime, setStartTime] = useState('08:00');
  const [serviceMin, setServiceMin] = useState(30); // výchozí globální délka schůzky
  const [summary, setSummary] = useState(null);     // {distanceKm, durationMin, etas[], etds[], late[], wait[]}

  const resetSummary = useCallback(() => setSummary(null), []);
  const clearAll = useCallback(() => { setSelected([]); setSummary(null); }, []);

  const makeOrderedPoints = (list) => list.map(p => ({ lat: p.lat, lng: p.lng, name: p.name }));

  const buildSchedule = (route, ordered, startAt, list, globalServiceMin, hasStart, hasEnd) => {
    if (!route || !ordered || !ordered.length) return null;

    // legs: mezi sousedními body sekvence [start?] + ordered + [end?]
    const legs = route.legs || [];
    const etas = [];
    const etds = [];
    const late = [];
    const wait = [];

    // map: koordinát → stop metadata (desired, durationMin)
    const key = (o) => `${o.lat.toFixed(6)},${o.lng.toFixed(6)}`;
    const meta = {};
    list.forEach(p => { meta[key(p)] = p; });

    let t = new Date(startAt.getTime());

    // příjezd na 1. klienta (pokud je startCoord, první leg je přesun start->klient0)
    if (hasStart) {
      t = new Date(t.getTime() + (legs[0]?.duration || 0) * 1000);
    }
    etas.push(new Date(t));
    const dur0 = (meta[key(ordered[0])] && Number(meta[key(ordered[0])].durationMin)) || Number(globalServiceMin) || 0;
    if (dur0 > 0) {
      const dep0 = new Date(t.getTime() + dur0 * 60 * 1000);
      etds.push(dep0);
      t = dep0;
    } else {
      etds.push(new Date(t));
    }

    // iterace přes legy mezi klienty
    for (let i = 0; i < ordered.length - 1; i++) {
      const legIdx = (hasStart ? 1 : 0) + i;
      t = new Date(t.getTime() + (legs[legIdx]?.duration || 0) * 1000); // přesun
      etas.push(new Date(t));
      const md = meta[key(ordered[i + 1])];
      const dur = (md && Number(md.durationMin)) || Number(globalServiceMin) || 0;
      if (dur > 0) {
        const dep = new Date(t.getTime() + dur * 60 * 1000);
        etds.push(dep);
        t = dep;
      } else {
        etds.push(new Date(t));
      }
    }

    // pokud je endCoord, poslední leg (klientN -> cíl) se započítá do celkové distance/duration,
    // ETAs už ale nepřidáváme (cíl není klient)

    // desired flagy
    for (let i = 0; i < ordered.length; i++) {
      const md = meta[key(ordered[i])];
      const ds = (md?.desired || '').trim();
      if (!ds) { late.push(false); wait.push(false); continue; }
      const want = hhmmToDate(ds);
      if (etas[i].getTime() > want.getTime()) { late.push(true); wait.push(false); }
      else if (etas[i].getTime() < want.getTime()) { late.push(false); wait.push(true); }
      else { late.push(false); wait.push(false); }
    }

    return {
      distanceKm: Math.round((route.distance || 0) / 10) / 100, // km, 2 dec
      durationMin: Math.round((route.duration || 0) / 60),      // čistý drive time (vč. start->1 a N->end)
      etas, etds, late, wait
    };
  };

  const plan = useCallback(async (list, optimize = false, opts = {}) => {
    if (!list || list.length < 2) return { route: null, ordered: null };
    const { startCoord = null, endCoord = null } = opts;

    const pts = makeOrderedPoints(list);
    const ordered = optimize ? await nearestNeighborOrder(pts) : pts;
    const route = await fetchRoute(ordered, startCoord, endCoord);

    const startAt = hhmmToDate(startTime);
    const sched = buildSchedule(route, ordered, startAt, list, serviceMin, !!startCoord, !!endCoord);
    setSummary(sched);

    return { route, ordered };
  }, [startTime, serviceMin]);

  const reorderSelectedToOrdered = useCallback((prevSelected, orderedPts) => {
    const mapPrev = {};
    prevSelected.forEach(p => { mapPrev[`${p.lat.toFixed(6)},${p.lng.toFixed(6)}`] = p; });
    return orderedPts.map(o => mapPrev[`${o.lat.toFixed(6)},${o.lng.toFixed(6)}`]);
  }, []);

  const gmapsLink = useMemo(() => {
    if (!selected || selected.length < 2) return '';
    const parts = selected.map(p => `${p.lat},${p.lng}`);
    const origin = parts[0];
    const dest = parts[parts.length - 1];
    const way = parts.slice(1, -1).join('/');
    return way
      ? `https://www.google.com/maps/dir/${origin}/${way}/${dest}`
      : `https://www.google.com/maps/dir/${origin}/${dest}`;
  }, [selected]);

  return {
    // data
    selected, setSelected,
    startTime, setStartTime,
    serviceMin, setServiceMin,
    summary, resetSummary,
    gmapsLink,

    // actions
    clearAll,
    plan,
    reorderSelectedToOrdered,
  };
}
