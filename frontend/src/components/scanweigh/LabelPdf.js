import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import QRCode from "qrcode";
import { FLIP, PAPER_MM } from "./constants";

// malé util
const MM = 2.83465;
const T_noUnicode = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// načtení fontu (zkusí pár cest)
async function tryLoadFontBytes(urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
    } catch {}
  }
  return null;
}

// odvození hodnot ze složeného carton_code (batch / item / index)
function splitFromCartonCode(carton_code) {
  if (!carton_code) return { batch: null, item: null, index: null };
  const s = String(carton_code);

  // Nejprve zkus dělení běžnými oddělovači (-, _, /, |, :)
  const tokens = s.split(/[-_/|:]+/);
  if (tokens.length >= 3) {
    const batch = tokens[0] || null;
    const item  = tokens[1] || null;
    const last  = tokens[tokens.length - 1] || "";
    const mIdx  = last.match(/\d+/);
    const index = mIdx ? mIdx[0] : last || null;
    return { batch, item, index };
  }

  // fallback: poslední souvislé číslice jako index
  const m = s.match(/(\d+)\s*$/);
  const index = m ? m[1] : null;
  return { batch: null, item: null, index };
}

export async function buildLabelPdfBase64({
  carton_code, measurement_id, weight,
  position_to_show, pallet_slot_id, item_code, batch_text, slot_name
}) {
  // rozměr papíru
  const { width: WIDTH_MM, height: HEIGHT_MM } = PAPER_MM;
  const W = (FLIP ? HEIGHT_MM : WIDTH_MM) * MM;
  const H = (FLIP ? WIDTH_MM  : HEIGHT_MM) * MM;

  // okraje
  const M_TOP = 3 * MM, M_BOTTOM = 2 * MM, M_SIDE = 2 * MM;
  const CONTENT_H = H - M_TOP - M_BOTTOM;
  const THIRD = CONTENT_H / 3;
  const TOP_Y0 = H - M_TOP - THIRD, TOP_Y1 = H - M_TOP;
  const MID_Y0 = H - M_TOP - 2 * THIRD, MID_Y1 = H - M_TOP - THIRD;
  const BOT_Y0 = H - M_TOP - 3 * THIRD;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([W, H]);
  page.setRotation(degrees(0));

  // fonty – zkus unicode, fallback Helvetica
  let fR, fB, unicode = false;
  try {
    const { default: fontkit } = await import("@pdf-lib/fontkit");
    pdf.registerFontkit(fontkit);
    const regBytes  = await tryLoadFontBytes([
      "/fonts/LiberationSans-Regular.ttf",
      "/fonts/OpenSans-Regular.ttf",
      "/fonts/NotoSans-Regular.ttf",
      "/fonts/DejaVuSans.ttf",
    ]);
    const boldBytes = await tryLoadFontBytes([
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
  const T = unicode ? (s)=>String(s ?? "") : T_noUnicode;

  // 1) QR v horní třetině
  const qrPayload = {
    carton_code: carton_code ?? null,
    measured_weight: Number(weight ?? 0),
    prep_position: Number(position_to_show ?? 0),
    prep_positioun: Number(position_to_show ?? 0), // kompatibilita s překlepem
  };
  const qrDataUrl = await QRCode.toDataURL(JSON.stringify(qrPayload), { margin: 0, scale: 8 });
  const qrImg = await pdf.embedPng(qrDataUrl);
  const topWidth = W - 2 * M_SIDE;
  const topHeight = THIRD;
  const qrSize = Math.min(topHeight * 0.82, topWidth * 0.82);
  const qrX = M_SIDE + (topWidth - qrSize) / 2;
  const qrY = TOP_Y0 + (topHeight - qrSize) / 2;
  page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  // oddělovací tenké čáry
  page.drawRectangle({ x:M_SIDE, y: MID_Y1 - 1, width: W - 2*M_SIDE, height: 1.5, color: rgb(0,0,0) });
  page.drawRectangle({ x:M_SIDE, y: TOP_Y1 - 1, width: W - 2*M_SIDE, height: 1.5, color: rgb(0,0,0) });

  // 2) prostřední třetina – 3 řádky (šarže / kód / index) → váha → výrazný slot (bez popisku)
  const padX = M_SIDE + 2 * MM;
  const lineH = 6 * MM;
  let y = MID_Y1 - 2 * MM;

  // odvození z carton_code + preferuj explicitní vstupy (batch_text, item_code)
  const derived = splitFromCartonCode(carton_code);
  const batchVal = batch_text || derived.batch || "";
  const itemVal  = item_code  || derived.item  || "";
  const indexVal = derived.index || "";

  // 1) šarže
  if (batchVal) {
    y -= lineH;
    page.drawText(T(batchVal), {
      x: padX, y, size: 10, font: fB, color: rgb(0,0,0),
      maxWidth: W - padX - M_SIDE
    });
  }

  // 2) kód produktu
  if (itemVal) {
    y -= lineH;
    page.drawText(T(itemVal), {
      x: padX, y, size: 10, font: fB, color: rgb(0,0,0),
      maxWidth: W - padX - M_SIDE
    });
  }

  // 3) pořadí balíku (carton_index z konce kódu)
  if (indexVal) {
    y -= lineH;
    page.drawText(T(indexVal), {
      x: padX, y, size: 10, font: fB, color: rgb(0,0,0),
      maxWidth: W - padX - M_SIDE
    });
  }

  // 4) váha
  if (Number.isFinite(Number(weight))) {
    y -= lineH;
    page.drawText(`${Number(weight).toFixed(3)} kg`, {
      x: padX, y, size: 12, font: fB, color: rgb(0,0,0),
      maxWidth: W - padX - M_SIDE
    });
  }

  // 5) slot – bez "Slot:", 2× větší a tučně
  if (slot_name) {
    y -= lineH;
    const value = T(slot_name);
    // původně ~8 → dvojnásobek 16; případně zmenšíme, aby se vešlo do šířky
    let fs = 16;
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

  // 3) spodní třetina – velká pozice/RK
  const isRK = Number(position_to_show) === 0;
  const posText = isRK ? "RK" : String(position_to_show);
  const posSize = 50;
  const tw = fB.widthOfTextAtSize(T(posText), posSize);
  const th = fB.heightAtSize(posSize);
  const posX = (W - tw) / 2;
  const posY = BOT_Y0 + (THIRD - th) / 2;
  page.drawText(T(posText), { x: posX, y: posY, size: posSize, font: fB, color: rgb(0,0,0) });

  return await pdf.saveAsBase64({ dataUri: false });
}
