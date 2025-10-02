import axios from "axios";
import { API_BASE, USER_ID } from "../components/scanweigh/constants";

export async function saveMeasure({
  line_id, pallet_slot_id, measured_weight, prep_position,
  pallet_id, ean, user_id = USER_ID
}) {
  const resp = await axios.post(`${API_BASE}/np/measure`, {
    line_id: Number(line_id),
    pallet_slot_id: pallet_slot_id ?? null,
    measured_weight: Number(measured_weight),
    prep_position: Number(prep_position),
    user_id: Number(user_id),
    pallet_id: pallet_id ?? null,
    ean: ean ?? null,
  });
  return resp?.data || null;
}

export async function setRefWeight({ line_id, new_gross_weight_ctn_kg }) {
  const r = await axios.post(`${API_BASE}/np/set-ref-weight`, {
    line_id: Number(line_id),
    new_gross_weight_ctn_kg: Number(new_gross_weight_ctn_kg),
  });
  return r?.data || null;
}
