// =============================================================
// File: src/utils/qr.js
// =============================================================
export const s = v => String(v ?? '').trim();

export const normSlots = (it) => {
  const slotsArr = Array.isArray(it.slots) ? it.slots : [];
  const namesArr = Array.isArray(it.slot_names) ? it.slot_names : [];
  if (slotsArr.length) {
    return slotsArr
      .map(x => ({
        slot_name: s(x?.slot_name),
        status: x?.status ?? null,
        floorNumber: x?.floorNumber ?? x?.floor_number ?? null
      }))
      .filter(x => x.slot_name);
  }
  if (namesArr.length) {
    return namesArr
      .map(n => (typeof n === 'string'
        ? { slot_name: s(n), status: null, floorNumber: null }
        : { slot_name: s(n?.slot_name), status: n?.status ?? null, floorNumber: n?.floorNumber ?? n?.floor_number ?? null }
      ))
      .filter(x => x.slot_name);
  }
  return [];
};

/** QR parser – JSON, query-like i volný text, plus "holý" NP kód */
export function parseQrPayload(raw) {
  const out = {};
  const str = String(raw ?? '').trim();

  // 1) JSON { ... } nebo "k:v, k:v"
  try {
    const jsonStr = str.startsWith('{') ? str : (str.includes(':') ? `{${str}}` : '');
    if (jsonStr) {
      const j = JSON.parse(jsonStr);
      const norm = (k) => String(k).toLowerCase().replace(/[.\s]/g, '_');
      for (const [k, v] of Object.entries(j)) out[norm(k)] = v;
    }
  } catch (_) {}

  // 2) Query-like "a=b,c=d"
  if (!Object.keys(out).length) {
    try {
      const qs = new URLSearchParams(str.replace(/[{}\"]/g, '').replace(/,/g, '&'));
      for (const [k, v] of qs.entries()) out[k.toLowerCase()] = v;
    } catch (_) {}
  }

  // 3) Ruční pick z textu (regexy)
  if (!out.carton_code) {
    const pick = (re) => { const m = str.match(re); return m && m[1] ? m[1] : undefined; };
    out.carton_code     = pick(/carton[_\s\-]?code['"]?\s*[:=]\s*['"]?([^,"'}\s]+)['"]?/i);
    out.measured_weight = out.measured_weight ?? pick(/measured[_\s\-]?weight['"]?\s*[:=]\s*['"]?([0-9]+(?:\.[0-9]+)?)['"]?/i);
    out.prep_position   = out.prep_position   ?? pick(/prep[_\s\-]pos(?:ition|itioun)?['"]?\s*[:=]\s*['"]?([0-9]+)['"]?/i);
  }

  // 4) HOLÝ NP kód (bez klíče) → decodeCartonCode
  if (!out.carton_code) {
    try {
      const c = decodeCartonCode(str);
      if (c) {
        out.carton_code  = c.cartonCode;   // snake_case pro stávající logiku
        out.cartonCode   = c.cartonCode;   // camelCase pro případ jinde
        out.productCode  = c.productCode;
        out.boxNumber    = c.boxNumber;
        out.boxNumberStr = c.boxNumberStr;
      }
    } catch (_) {}
  }

  return out;
}

// GS1 Digital Link: extract GTIN from /01/<gtin> in URL-like payload
export function extractGs1Gtin(raw) {
  try {
    const str = String(raw ?? '').trim();
    if (!str) return null;
    try {
      const url = new URL(str, (typeof window !== 'undefined' && window.location ? window.location.origin : 'http://x'));
      const segs = url.pathname.split('/').filter(Boolean);
      const i01 = segs.indexOf('01');
      if (i01 >= 0 && segs[i01 + 1]) return segs[i01 + 1];
    } catch (_) {}
    const m = str.match(/\/01\/(\d{8,18})/);
    if (m) return m[1];
  } catch (_) {}
  return null;
}

// --- Decodér krabicového kódu: "NP41190-OB12FF.76-0035"
export function decodeCartonCode(input) {
  const str = String(input ?? '').trim();
  if (!str) return null;
  const m = str.match(/^([A-Z]+[0-9]+)-([A-Z0-9]+(?:\.[A-Z0-9]+)*)-([0-9]+(?:\/\d+)?)$/i);
  if (!m) return null;
  const [, npCode, productCode, boxRaw] = m;
  const [boxNumberStr, partStr] = String(boxRaw).split('/');
  const boxNumber = Number(boxNumberStr);
  return {
    cartonCode: str,
    npCode,
    productCode,
    boxNumberStr,
    boxNumber: Number.isFinite(boxNumber) ? boxNumber : null,
    part: partStr ? Number(partStr) : null
  };
}

// Z href jako ".../order/pp%C5%9966124" vytáhne čitelný orderNumber
export function extractOrderNumberFromHref(href) {
  try {
    const tail = String(href || '').split('/order/')[1] || '';
    return decodeURIComponent(tail);
  } catch {
    return null;
  }
}

// Parsuje "raw" JSON string ze scanlogu + opraví překlep prep_positioun -> prep_position
export function parseScanlogRaw(rawStr) {
  try {
    const obj = JSON.parse(String(rawStr || '{}'));
    if (obj.prep_positioun != null && obj.prep_position == null) {
      obj.prep_position = obj.prep_positioun;
    }
    return obj;
  } catch {
    return {};
  }
}
