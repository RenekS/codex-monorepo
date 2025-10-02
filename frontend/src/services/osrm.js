// src/services/osrm.js
import axios from 'axios';

/**
 * Základní URL OSRM serveru:
 * - nastav proměnnou prostředí REACT_APP_OSRM_URL pro vlastní server (např. http://osrm.local:5000)
 * - jinak spadne na veřejný demo server (nevhodné pro heavy provoz)
 */
export const OSRM_BASE = process.env.REACT_APP_OSRM_URL || 'https://router.project-osrm.org';

const coordsStr = (arr) => arr.map(p => `${p.lng},${p.lat}`).join(';');

const buildRouteUrl = (points) =>
  `${OSRM_BASE}/route/v1/driving/${coordsStr(points)}?overview=full&geometries=geojson&steps=false`;

const buildTableUrl = (points) =>
  `${OSRM_BASE}/table/v1/driving/${coordsStr(points)}?annotations=duration`;

/**
 * Zavolá OSRM /route a vrátí první trasu (nebo null).
 * @param {Array<{lat:number,lng:number}>} orderedPoints – POŘADÍ je důležité!
 */
export async function fetchRoute(orderedPoints) {
  if (!orderedPoints || orderedPoints.length < 2) return null;
  const url = buildRouteUrl(orderedPoints);
  const res = await axios.get(url);
  return res.data?.routes?.[0] || null; // {distance, duration, legs[], geometry{GeoJSON}}
}

/**
 * Zavolá OSRM /table a vrátí matici dob jízd (v sekundách) NxN.
 * @param {Array<{lat:number,lng:number}>} points
 */
export async function fetchMatrix(points) {
  if (!points || points.length < 2) return null;
  const url = buildTableUrl(points);
  const res = await axios.get(url);
  return res.data?.durations || null; // NxN (seconds)
}

/**
 * Jednoduchá heuristika „nearest neighbor“ nad maticí dob jízd.
 * Zachová první bod jako start a přidává vždy nejbližší další.
 * @param {Array<{lat:number,lng:number}>} points
 * @returns {Array<{lat:number,lng:number}>} – nové pořadí bodů
 */
export async function nearestNeighborOrder(points) {
  if (!points || points.length <= 2) return points || [];
  const durations = await fetchMatrix(points);
  if (!durations) return points;

  const n = points.length;
  const used = Array(n).fill(false);
  const orderIdx = [0]; // startujeme prvním vybraným
  used[0] = true;

  for (let step = 1; step < n; step++) {
    const last = orderIdx[orderIdx.length - 1];
    let best = -1, bestCost = Infinity;
    for (let j = 0; j < n; j++) {
      if (!used[j] && Number.isFinite(durations[last][j]) && durations[last][j] < bestCost) {
        bestCost = durations[last][j];
        best = j;
      }
    }
    if (best === -1) {
      // něco je špatně v matici – doplň zbylé body v původním pořadí
      for (let j = 0; j < n; j++) if (!used[j]) orderIdx.push(j);
      break;
    }
    used[best] = true;
    orderIdx.push(best);
  }

  return orderIdx.map(i => points[i]);
}
