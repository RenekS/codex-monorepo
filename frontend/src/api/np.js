import axios from "axios";
const API = process.env.REACT_APP_API_URL;

export const getDetail = (id) => axios.get(`${API}/np/detail/${id}`).then(r=>r.data);
export const saveWeight = (line_id, weight) =>
  axios.post(`${API}/np/weight-save`, { line_id, weight });

export const saveMeasure = (payload) =>
  axios.post(`${API}/np/measure`, payload).then(r=>r.data);

export const togglePalletCheck = (pallet_id, checked) =>
  axios.post(`${API}/np/pallet-check`, { pallet_id, checked });
