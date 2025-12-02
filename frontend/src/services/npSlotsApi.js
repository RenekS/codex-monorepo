// src/services/npSlotsApi.js
import { api } from './api';

export async function setMeasurementSlotAPI(guard, payload) {
  const { data } = await guard(api.post('/np/measurements/set-slot', payload));
  return data;
}

export async function unassignMeasurementsAPI(guard, payload) {
  const { data } = await guard(api.post('/np/measurements/unassign', payload));
  return data;
}

export async function freeSlotAPI(guard, slotId) {
  const { data } = await guard(api.post(`/np/slots/${slotId}/free`, { confirm: true }));
  return data;
}
