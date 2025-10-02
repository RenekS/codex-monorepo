// =============================================================
// File: src/services/wmsApi.js
// =============================================================
import axios from 'axios';
export const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';
export const api = axios.create({ baseURL: API_BASE });

export const getPickedOrders = async () => (await api.get('/api/orders/picked')).data;
export const getOrderDetail = async (orderNumber) => (await api.get(`/wms/order/${orderNumber}`)).data;
export const postEnsureIssue = async (orderNumber) => (await api.post('/wms/issues', { orderNumber })).data;
export const postPicked = async (orderNumber, payload) => (await api.post(`/wms/order/${orderNumber}/picked`, payload)).data;
export const getPickedItems = async (orderNumber, item_id) => (await api.get(`/wms/order/${orderNumber}/picked-items`, { params:{ item_id } })).data;
export const deletePickedItems = async (orderNumber, item_id, line_ids) => (await api.delete(`/wms/order/${orderNumber}/picked-items`, { data:{ item_id, line_ids } })).data;
