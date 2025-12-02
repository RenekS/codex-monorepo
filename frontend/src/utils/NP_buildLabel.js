// src/utils/NP_buildLabel.js
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import QRCode from "qrcode";

const FLIP = false;
const MM = 2.83465;

// --- Helpers --------------------------------------------------------------
function splitFromCartonCode(carton_code) {
  if (!carton_code) return { batch:null, item:null, index:null };
  const s = String(carton_code);
  const tokens = s.split(/[-_/|:]+/);
  if (tokens.length >= 3) {
    const batch = tokens[0] || null;
    const item  = tokens[1] || null;
    const idxRaw = tokens[tokens.length - 1] || null;
    const idx = idxRaw ? String(idxRaw).replace(/^0+/, "") : null;
    return { batch, item, index: idx };
  }
  try {
    const m = s.match(/^(.*?)[-_/|:](.*?)[-_/|:](\d+)$/);
    if (m) return { batch:m[1], item:m[2], index:String(Number(m[3])) };
  } catch {}
  return { batch:null, item:null, index:null };
}

// Unicode-safe fonts
const T_noUnicode = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
async function tryLoadFontBytes(urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
    } catch {}
  }
  return null;
}
async function loadFontsOrFallback(pdf) {
  try {
    const { default: fontkit } = await import("@pdf-lib/fontkit");
    pdf.registerFontkit(fontkit);
    const regBytes  = await tryLoadFontBytes([
      "/fonts/LiberationSans-Regular.ttf",
      "/fonts/OpenSans-Regular.ttf",
      "/fonts/DejaVuSans.ttf",
    ]);
    const boldBytes = await tryLoadFontBytes([
      "/fonts/LiberationSans-Bold.ttf",
      "/fonts/OpenSans-Bold.ttf",
      "/fonts/DejaVuSans-Bold.ttf",
    ]);
    if (regBytes && boldBytes) {
      const fR = await pdf.embedFont(regBytes, { subset: true });
      const fB = await pdf.embedFont(boldBytes, { subset: true });
      return { fR, fB, unicode: true };
    }
  } catch {}
  return { fR: await pdf.embedFont(StandardFonts.Helvetica), fB: await pdf.embedFont(StandardFonts.HelveticaBold), unicode: false };
}

// GS1 helpers
async function fetchGs1DigitalLink({ item_code, carton_code, level = "box" }) {
  try {
    const API = process.env.REACT_APP_API_URL || "";
    const params = new URLSearchParams({ item_code: String(item_code||""), carton_code: String(carton_code||""), level });
    const resp = await fetch(`${API}/np/gs1-link?${params.toString()}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data && data.url ? String(data.url) : null;
  } catch (e) { console.warn("fetchGs1DigitalLink failed", e); return null; }
}
async function fetchGs1LinkMeta({ item_code, carton_code, level = "box" }) {
  try {
    const API = process.env.REACT_APP_API_URL || "";
    const params = new URLSearchParams({ item_code: String(item_code||""), carton_code: String(carton_code||""), level });
    const resp = await fetch(`${API}/np/gs1-link?${params.toString()}`);
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) { console.warn("fetchGs1LinkMeta failed", e); return null; }
}
function parseAIsFromGs1Url(u) {
  try {
    const base = (typeof window !== "undefined" && window.location && window.location.origin) ? window.location.origin : "http://x";
    const url = new URL(String(u), base);
    const segs = url.pathname.split("/").filter(Boolean);
    const i01 = segs.indexOf("01");
    const ai01 = (i01 >= 0 && segs[i01+1]) ? segs[i01+1] : null;
    return { "01": ai01, "10": url.searchParams.get("10") || null, "11": url.searchParams.get("11") || null, "240": url.searchParams.get("240") || null };
  } catch { return {}; }
}
function mfgToMMYY(s) {
  if (!s) return null;
  const raw = String(s).trim();
  // MM/YYYY or MM/YY
  const m = raw.match(/^(\d{2})\s*\/\s*(\d{2,4})$/);
  if (m) return `${m[1]}/${m[2].slice(-2)}`;
  // YYMMDD or YYMM00
  const t = raw.replace(/\D/g, "");
  if (t.length >= 4) {
    const yy = t.slice(0,2);
    const mm = t.slice(2,4);
    return `${mm}/${yy}`;
  }
  return null;
}

// === Main ================================================================
export async function NP_buildLabelPdfBase64({
  carton_code,
  measurement_id,
  weight,
  position_to_show,
  pallet_slot_id,
  item_code,
  batch_text,
  slot_name,
  carton_index,
}) {
  const WIDTH_MM = 50, HEIGHT_MM = 100;
  const W = (FLIP ? HEIGHT_MM : WIDTH_MM) * MM;
  const H = (FLIP ? WIDTH_MM  : HEIGHT_MM) * MM;

  const M_TOP = 3 * MM, M_BOTTOM = 2 * MM, M_SIDE = 2 * MM;
  const CONTENT_H = H - M_TOP - M_BOTTOM;
  const THIRD = CONTENT_H / 3;
  const TOP_Y0 = H - M_TOP - THIRD, TOP_Y1 = H - M_TOP;
  const MID_Y0 = H - M_TOP - 2 * THIRD, MID_Y1 = H - M_TOP - THIRD;
  const BOT_Y0 = H - M_TOP - 3 * THIRD;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([W, H]);
  page.setRotation(degrees(0));

  const { fR, fB, unicode } = await loadFontsOrFallback(pdf);
  const T = unicode ? (s)=> String(s ?? "") : T_noUnicode;

  // QR
  const qrPayload = {
    carton_code: carton_code ?? null,
    measured_weight: Number(weight ?? 0),
    prep_position: Number(position_to_show ?? 0),
    prep_positioun: Number(position_to_show ?? 0),
  };
  const gs1Url = await fetchGs1DigitalLink({ item_code, carton_code });
  const qrString = gs1Url || JSON.stringify(qrPayload);
  const qrDataUrl = await QRCode.toDataURL(qrString, { margin: 2, scale: 8 });
  const qrImg = await pdf.embedPng(qrDataUrl);

  // TOP: QR
  const topWidth = W - 2 * M_SIDE;
  const topHeight = THIRD;
  const qrSize = Math.min(topHeight * 0.82, topWidth * 0.82);
  const qrX = M_SIDE + (topWidth - qrSize) / 2;
  const qrY = TOP_Y0 + (topHeight - qrSize) / 2;
  page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  // separators
  page.drawRectangle({ x:M_SIDE, y: MID_Y1 - 1, width: W - 2*M_SIDE, height: 1.5, color: rgb(0,0,0) });
  page.drawRectangle({ x:M_SIDE, y: TOP_Y1 - 1, width: W - 2*M_SIDE, height: 1.5, color: rgb(0,0,0) });

  // MIDDLE: vertical info with labels
  const padX = M_SIDE + 2 * MM;
  const lineH = 4 * MM;
  let y = MID_Y1 - 2 * MM;

  const derived = splitFromCartonCode(carton_code);
  const batchVal  = batch_text || derived.batch || "";
  const itemVal   = item_code  || derived.item  || "";
  const indexVal  = (carton_index != null && carton_index !== "") ? String(carton_index) : (derived.index || "");

  const ai = parseAIsFromGs1Url(qrString || "");

  const drawLine = (label, value) => {
    if (!value) return;
    y -= lineH;
    const text = T(`${label}: ${value}`);
    let fs = 9;
    while (fs > 7) {
      const w = fB.widthOfTextAtSize(text, fs);
      if (w <= (W - padX - M_SIDE)) break;
      fs -= 1;
    }
    page.drawText(text, { x: padX, y, size: fs, font: fB, color: rgb(0,0,0), maxWidth: W - padX - M_SIDE });
  };

  drawLine("Šarže", batchVal);
  drawLine("Kód", itemVal);
  drawLine("Č. balíku", indexVal);

  // Hmotnost – FE -> fallback na meta
  try {
    const meta = await fetchGs1LinkMeta({ item_code, carton_code });
    const wval = Number(weight);
    const mval = meta && meta.measured_weight != null ? Number(meta.measured_weight) : NaN;
    const useW = (Number.isFinite(wval) && wval > 0) ? wval : (Number.isFinite(mval) ? mval : NaN);
    drawLine("Hmotnost", Number.isFinite(useW) ? `${useW.toFixed(3)} kg` : "");
  } catch {
    drawLine("Hmotnost", Number.isFinite(Number(weight)) && Number(weight) > 0 ? `${Number(weight).toFixed(3)} kg` : "");
  }

  if (ai["10"]) drawLine("Heat No.", String(ai["10"]).trim());
  const mmyy = mfgToMMYY(ai["11"]);
  if (mmyy) drawLine("MFG", mmyy);
  if (ai["240"]) drawLine("O-ring", ai["240"]);

  // SLOT (pallet_slot) slightly lower
  if (slot_name) {
    const SLOT_GAP_EXTRA = 2 * MM;
    y -= SLOT_GAP_EXTRA;
    y -= lineH;
    const value = T(String(slot_name));
    let fs = 16;
    while (fs > 10) {
      const w = fB.widthOfTextAtSize(value, fs);
      if (w <= (W - padX - M_SIDE)) break;
      fs -= 1;
    }
    page.drawText(value, { x: padX, y, size: fs, font: fB, color: rgb(0,0,0), maxWidth: W - padX - M_SIDE });
  }

  // BOTTOM: RK / position
  const isRK = Number(position_to_show) === 0;
  const posText = isRK ? "RK" : String(position_to_show);
  let posSize = 50;
  while (posSize > 10) {
    const tw = fB.widthOfTextAtSize(T(posText), posSize);
    if (tw <= (W - 2*M_SIDE)) break;
    posSize -= 2;
  }
  const posTw = fB.widthOfTextAtSize(T(posText), posSize);
  const posTh = fB.heightAtSize(posSize);
  const posX = (W - posTw) / 2;
  const posY = BOT_Y0 + (THIRD - posTh) / 2;
  page.drawText(T(posText), { x: posX, y: posY, size: posSize, font: fB, color: rgb(0,0,0) });

  return await pdf.saveAsBase64({ dataUri: false });
}
