// =============================================================
// File: src/utils/inventoryHelpers.js
// =============================================================
export const clean = v => (typeof v === 'string' ? v.trim() : '');
export const parseProdFromCode = (code) => {
  const s = clean(code).split('-');
  return s.length >= 2 ? clean(s[1]) : '';
};
export const extractCartonFromRaw = (raw) => {
  const s = clean(raw);
  if (!s) return '';
  if (s.startsWith('{') && s.endsWith('}')) {
    try { const o = JSON.parse(s); return clean(o.carton_code || o.code || ''); }
    catch {}
  }
  return s;
};
export const suffixNum = (code) => {
  const parts = clean(code).split('-');
  const tail = parts[parts.length - 1] || '';
  const n = parseInt(tail, 10);
  return Number.isFinite(n) ? n : 0;
};
export const suffixInt = (code) => {
  const m = String(code||'').match(/(\d+)\s*$/);
  return m ? parseInt(m[1],10) : null;
};
export const looksLikeQr = (s) => typeof s === 'string' && s.includes('-') && s.split('-').length >= 3;
export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
export function isValidEAN13(code) {
  const s = String(code || '').replace(/\D/g, '');
  if (s.length !== 13) return false;
  const digits = s.split('').map(d=>+d);
  const check = digits.pop();
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  const calc = (10 - (sum % 10)) % 10;
  return calc === check;
}
