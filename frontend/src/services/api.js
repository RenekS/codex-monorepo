// =============================================================
// File: src/services/api.js
// =============================================================
import axios from 'axios';
import { API_BASE } from '../constants/inventory';
import { useNavigate } from 'react-router-dom';

export const api = axios.create({ baseURL: API_BASE });

export const useGuard = () => {
  const navigate = useNavigate();
  const guard = async (p) => {
    try { return await p; }
    catch (e) { if (e?.response?.status === 401) navigate('/login'); throw e; }
  };
  return guard;
};

export async function fetchSlots(guard, { onlyUninventorized }) {
  const params = {};
  if (onlyUninventorized) params.inventarisation = 0;
  const { data } = await guard(api.get('/api/pallet-slots', { params }));
  return data;
}
export async function fetchSlotStock(guard, slotId) {
  const { data } = await guard(api.get(`/api/slot/${slotId}/stock`));
  return data;
}
export async function peekCode(guard, { slotId, code }) {
  const { data } = await guard(api.post('/api/initial-inventory/peek-code', { slotId, code }));
  return data;
}
export async function commitSlotAPI(guard, payload) {
  const { data } = await guard(api.post('/api/initial-inventory/commit-slot', payload));
  return data;
}
export async function reassignToUnassignedAPI(guard, body) {
  const { data } = await guard(api.post('/api/initial-inventory/reassign-to-unassigned', body));
  return data;
}
export async function patchQtyAPI(guard, measurementId, qty) {
  return guard(api.patch(`/api/measurement/${measurementId}/qty`, { qty: Number(qty || 0) }));
}