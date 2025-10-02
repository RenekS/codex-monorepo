// =============================================================
// File: src/utils/qr.js
// =============================================================
export const s = v => String(v ?? '').trim();
export const normSlots = (it) => {
  const slotsArr = Array.isArray(it.slots) ? it.slots : [];
  const namesArr = Array.isArray(it.slot_names) ? it.slot_names : [];
  if (slotsArr.length) {
    return slotsArr.map(x => ({ slot_name: s(x?.slot_name), status: x?.status ?? null, floorNumber: x?.floorNumber ?? x?.floor_number ?? null })).filter(x => x.slot_name);
  }
  if (namesArr.length) {
    return namesArr.map(n => (typeof n === 'string'
      ? { slot_name: s(n), status: null, floorNumber: null }
      : { slot_name: s(n?.slot_name), status: n?.status ?? null, floorNumber: n?.floorNumber ?? n?.floor_number ?? null }
    )).filter(x => x.slot_name);
  }
  return [];
};

/** QR parser – zvládá JSON, query-like i volný text; umí i překlep "prep_positioun" */
export function parseQrPayload(raw) {
  const out = {}; const str = String(raw ?? '').trim();
  try {
    const jsonStr = str.startsWith('{') ? str : (str.includes(':') ? `{${str}}` : '');
    if (jsonStr) {
      const j = JSON.parse(jsonStr);
      const norm = (k) => String(k).toLowerCase().replace(/[.\s]/g, '_');
      for (const [k,v] of Object.entries(j)) out[norm(k)] = v;
      return out;
    }
  } catch(_){}
  try {
    const qs = new URLSearchParams(str.replace(/[{}\"]/g, '').replace(/,/g, '&'));
    for (const [k,v] of qs.entries()) out[k.toLowerCase()] = v;
    if (Object.keys(out).length) return out;
  } catch(_){}
  const pick = (re) => { const m = str.match(re); return m && m[1] ? m[1] : undefined; };
  out.carton_code     = pick(/carton[_\s\-]?code['"]?\s*[:=]\s*['"]?([^,"'}\s]+)['"]?/i);
  out.measured_weight = pick(/measured[_\s\-]?weight['"]?\s*[:=]\s*['"]?([0-9]+(?:\.[0-9]+)?)['"]?/i);
  out.prep_position   = pick(/prep[_\s\-]pos(?:ition|itioun)?['"]?\s*[:=]\s*['"]?([0-9]+)['"]?/i);
  return out;
}
