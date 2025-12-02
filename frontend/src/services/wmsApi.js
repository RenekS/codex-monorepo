// =============================================================
// File: src/services/wmsApi.js
// =============================================================
import axios from 'axios';

// Preferuj REACT_APP_API_URL / REACT_APP_API_BASE; povol i window.__API_BASE__ / localStorage('API_BASE')
// Fallback: stejné hostname + :3000; poslední fallback: localhost:3001
export const API_BASE =
  (typeof process !== 'undefined' && process.env && (process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE)) ||
  (typeof window !== 'undefined' && (window.__API_BASE__ || (window.localStorage && localStorage.getItem && localStorage.getItem('API_BASE')))) ||
  (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3000` : 'http://localhost:3001');

export const api = axios.create({ baseURL: API_BASE });

// --- Orders / WMS ---
export const getPickedOrders   = async () => (await api.get('/api/orders/picked')).data;
export const getOrderDetail    = async (orderNumber) => (await api.get(`/wms/order/${orderNumber}`)).data;

// Výdejka (ensure otevřené issue pro objednávku)
export const postEnsureIssue   = async (orderNumber) => (await api.post('/wms/issues', { orderNumber })).data;

// Ledger zápisy přímo do WH_IssueItems (bez /picked)
export const postIssueLine     = async (issueId, payload) => (
  await api.post(`/wms/issues/${issueId}/line`, payload)
).data;

// Čtení / mazání naskenovaných řádků pro item
export const getPickedItems    = async (orderNumber, item_id) => (
  await api.get(`/wms/order/${orderNumber}/picked-items`, { params: { item_id } })
).data;

export const deletePickedItems = async (orderNumber, item_id, line_ids) => (
  await api.delete(`/wms/order/${orderNumber}/picked-items`, { data: { item_id, line_ids } })
).data;

// --- Resolve carton_code -> produkt/measurement/slot ---
export const resolveCarton     = async (orderNumber, cartonCode) => {
  const res = await api.get('/wms/carton/resolve', {
    params: {
      order_number: orderNumber,
      carton_code: cartonCode,
      _: Date.now(), // cache-buster proti 304
    },
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
    validateStatus: (s) => (s >= 200 && s < 300) || s === 204 || s === 304,
  });
  if (res.status === 304) {
    throw new Error('Resolve 304 Not Modified (bez těla) – vypněte cache nebo použijte cache-buster.');
  }
  if (res.status === 204) {
    // BE řekl "success bez dat" => vrátíme qty=0, aby UI jelo dál
    return { ok: true, qty: 0 };
  }
  return res.data;
};
