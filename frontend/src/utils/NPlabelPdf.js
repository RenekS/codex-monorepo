import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import QRCode from "qrcode";
import { FLIP } from "../api/NPconfig";
// --- Helpers for GS1 Digital Link ---
async function fetchGs1DigitalLink({ item_code, carton_code, level = 'box' }) {
  try {
    const API = process.env.REACT_APP_API_URL || '';
    const params = new URLSearchParams({ item_code: String(item_code||''), carton_code: String(carton_code||''), level });
    const url = `${API}/np/gs1-link?${params.toString()}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data && data.url ? String(data.url) : null;
  } catch (e) {
    console.warn('fetchGs1DigitalLink failed', e);
    return null;
  }
}
function parseAIsFromGs1Url(u) {
  try {
    const base = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'http://x';
    const url = new URL(String(u), base);
    return {
      '01': (url.pathname.split('/').includes('01') ? url.pathname.split('/').pop() : null),
      '10': url.searchParams.get('10') || null,
      '11': url.searchParams.get('11') || null,
      '240': url.searchParams.get('240') || null
    };
  } catch { return {}; }
}
function mfgToMMYY(s) {
  if (!s) return null;
  const t = String(s).replace(/\D/g,''); // accept YYMMDD / YYMM00
  if (t.length < 4) return null;
  const yy = t.slice(0,2);
  const mm = t.slice(2,4);
  return `${mm}/${yy}`;
}

const MM = 2.83465;

function splitFromCartonCode(carton_code) {
  // Pokusí se odvodit [batch, item, index] z carton_code
  if (!carton_code) return { batch:null, item:null, index:null };

  const s = String(carton_code);

  // 1) vzor: BATCH-ITEM-123 nebo BATCH/ITEM/123 apod.
  const tokens = s.split(/[-_/|:]+/);
  if (tokens.length >= 3) {
    const batch = tokens[0] || null;
    const item  = tokens[1] || null;
    const idxRaw = tokens[tokens.length - 1] || null;
    const index = idxRaw && /\d+/.test(idxRaw) ? idxRaw.match(/\d+/)[0] : null;
    return { batch, item, index };
  }

  // 2) vzor: cokoliv-cokoliv-XYZ123 (vezmi poslední čísla jako index)
  const m2 = s.match(/^(.*?)[-_/|:]([A-Za-z0-9]+)[-_/|:](\d+)$/);
  if (m2) return { batch: m2[1], item: m2[2], index: m2[3] };

  // 3) fallback: poslední souvislé číslice jako index
  const m3 = s.match(/(\d+)\s*$/);
  const index = m3 ? m3[1] : null;
  return { batch: null, item: null, index };
}

export async function NP_buildLabelPdfBase64({
  carton_code,
  measurement_id,
  weight,
  position_to_show,   // stálá tisková pozice z FE
  pallet_slot_id,
  item_code,
  batch_text,
  slot_name,
  carton_index,        // NOVĚ volitelný vstup (pořadí balíku)
}) {
  // Papír: 50 (š) × 100 (v) mm — PORTRAIT (příp. prohoditelné přes FLIP)
  const WIDTH_MM = 50, HEIGHT_MM = 100;
  const W = (FLIP ? HEIGHT_MM : WIDTH_MM) * MM;
  const H = (FLIP ? WIDTH_MM  : HEIGHT_MM) * MM;

  // Bezpečné okraje
  const M_TOP_MM = 3;
  const M_BOTTOM_MM = 2;
  const M_SIDE_MM = 2;
  const M_TOP = M_TOP_MM * MM, M_BOTTOM = M_BOTTOM_MM * MM, M_SIDE = M_SIDE_MM * MM;

  const CONTENT_H = H - M_TOP - M_BOTTOM;
  const THIRD = CONTENT_H / 3;

  // Horní třetina (pro QR)
  const TOP_Y0 = H - M_TOP - THIRD;
  const TOP_Y1 = H - M_TOP;

  // Prostřední třetina (pro texty)
  const MID_Y0 = H - M_TOP - 2 * THIRD;
  const MID_Y1 = H - M_TOP - THIRD;

  // Spodní třetina (velká pozice/RK)
  const BOT_Y0 = H - M_TOP - 3 * THIRD; // = M_BOTTOM

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([W, H]);
  page.setRotation(degrees(0));

  // Fonty (Unicode, když jsou k dispozici v /public/fonts)
  let fR, fB, unicode = false;
  try {
    const { default: fontkit } = await import("@pdf-lib/fontkit");
    pdf.registerFontkit(fontkit);

    async function tryLoad(urls) {
      for (const url of urls) {
        try {
          const r = await fetch(url);
          if (r.ok) return new Uint8Array(await r.arrayBuffer());
        } catch {}
      }
      return null;
    }

    const regBytes  = await tryLoad([
      "/fonts/LiberationSans-Regular.ttf",
      "/fonts/OpenSans-Regular.ttf",
      "/fonts/NotoSans-Regular.ttf",
      "/fonts/DejaVuSans.ttf",
    ]);
    const boldBytes = await tryLoad([
      "/fonts/LiberationSans-Bold.ttf",
      "/fonts/NotoSans-Bold.ttf",
      "/fonts/DejaVuSans-Bold.ttf",
    ]);

    if (regBytes && boldBytes) {
      fR = await pdf.embedFont(regBytes, { subset: true });
      fB = await pdf.embedFont(boldBytes, { subset: true });
      unicode = true;
    }
  } catch {}

  if (!unicode) {
    fR = await pdf.embedFont(StandardFonts.Helvetica);
    fB = await pdf.embedFont(StandardFonts.HelveticaBold);
  }

  const T = (s)=> unicode ? String(s ?? "") : String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  /* ===== 1) HORNÍ TŘETINA: QR (s tichou zónou) ===== */
  const qrPayload = {
    carton_code: carton_code ?? null,
    measured_weight: Number(weight ?? 0),
    prep_position: Number(position_to_show ?? 0),
    prep_positioun: Number(position_to_show ?? 0), // kompatibilita s překlepem
  };

  const gs1Url = await fetchGs1DigitalLink({ item_code, carton_code });
  const qrString = gs1Url || JSON.stringify(qrPayload);
  const qrDataUrl = await QRCode.toDataURL(qrString, { margin: 2, scale: 8 });
  const qrImg = await pdf.embedPng(qrDataUrl);

  const topWidth = W - 2 * M_SIDE;
  const topHeight = THIRD;
  const qrSize = Math.min(topHeight * 0.82, topWidth * 0.82);
  const qrX = M_SIDE + (topWidth - qrSize) / 2;
  const qrY = TOP_Y0 + (topHeight - qrSize) / 2;
  page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  // oddělovací linky mezi třetinami
  page.drawRectangle({ x:M_SIDE, y: MID_Y1 - 1, width: W - 2*M_SIDE, height: 1.5, color: rgb(0,0,0) });
  page.drawRectangle({ x:M_SIDE, y: TOP_Y1 - 1, width: W - 2*M_SIDE, height: 1.5, color: rgb(0,0,0) });

  /* ===== 2) PROSTŘEDNÍ TŘETINA: 3 řádky (šarže / kód / index), pak váha, pak výrazný slot ===== */
  const padX = M_SIDE + 2 * MM;
  const lineH = 6 * MM;
  let y = MID_Y1 - 2 * MM; // start kousek pod horní čarou prostřední třetiny

  // Odvození hodnot z carton_code (fallbacky)
  const derived = splitFromCartonCode(carton_code);
  const batchVal  = batch_text || derived.batch || "";
  const itemVal   = item_code  || derived.item  || "";
  const indexVal  = (carton_index != null && carton_index !== "") ? String(carton_index) : (derived.index || "");

  // 1) Šarže (jen hodnota, bez popisku)
  if (batchVal) {
    y -= lineH;
    page.drawText(T(batchVal), {
      x: padX, y, size: 10, font: fB, color: rgb(0,0,0),
      maxWidth: W - padX - M_SIDE
    });
  }

  // 2) Kód produktu (jen hodnota)
  if (itemVal) {
    y -= lineH;
    page.drawText(T(itemVal), {
      x: padX, y, size: 10, font: fB, color: rgb(0,0,0),
      maxWidth: W - padX - M_SIDE
    });
  }

  // 3) Pořadí balíku (jen hodnota)
  if (indexVal) {
    y -= lineH;
    page.drawText(T(indexVal), {
      x: padX, y, size: 10, font: fB, color: rgb(0,0,0),
      maxWidth: W - padX - M_SIDE
    });
  }

  // 4) Váha (xx.xxx kg)
  if (Number.isFinite(Number(weight))) {
    y -= lineH;
    page.drawText(`${Number(weight).toFixed(3)} kg`, {
      x: padX, y, size: 12, font: fB, color: rgb(0,0,0),
      maxWidth: W - padX - M_SIDE
    });
  }

  // 5) Slot (jen hodnota, 2× větší a tučně) – bez "Slot:"
  if (slot_name) {
    y -= lineH;
    const value = T(slot_name);
    // základ byl 9 px => 2× = 18; dynamicky zmenšíme, kdyby se nevešlo
    let fs = 18;
    while (fs > 10) {
      const w = fB.widthOfTextAtSize(value, fs);
      if (w <= (W - padX - M_SIDE)) break;
      fs -= 1;
    }
    page.drawText(value, {
      x: padX, y, size: fs, font: fB, color: rgb(0,0,0),
      maxWidth: W - padX - M_SIDE
    });
  }

  /* ===== 3) SPODNÍ TŘETINA: velká pozice/RK (beze změny) ===== */
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
