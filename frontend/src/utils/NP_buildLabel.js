// src/utils/NP_buildLabel.js
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import QRCode from "qrcode";

// máš-li v projektu přepínač rotace, můžeš si ho sem případně propsat
const FLIP = false;
const MM = 2.83465;

function splitFromCartonCode(carton_code) {
  if (!carton_code) return { batch:null, item:null, index:null };
  const s = String(carton_code);
  const tokens = s.split(/[-_/|:]+/);
  if (tokens.length >= 3) {
    const batch = tokens[0] || null;
    const item  = tokens[1] || null;
    const idxRaw = tokens[tokens.length - 1] || null;
    const index = idxRaw && /\d+/.test(idxRaw) ? idxRaw.match(/\d+/)[0] : null;
    return { batch, item, index };
  }
  const m2 = s.match(/^(.*?)[-_/|:]([A-Za-z0-9]+)[-_/|:](\d+)$/);
  if (m2) return { batch: m2[1], item: m2[2], index: m2[3] };
  const m3 = s.match(/(\d+)\s*$/);
  const index = m3 ? m3[1] : null;
  return { batch: null, item: null, index };
}

export async function NP_buildLabelPdfBase64({
  carton_code,
  measurement_id,
  weight,
  position_to_show,   // tisková pozice (pokud používáš)
  pallet_slot_id,
  item_code,
  batch_text,
  slot_name,
  carton_index,        // pořadí balíku
}) {
  const WIDTH_MM = 50, HEIGHT_MM = 100;
  const W = (FLIP ? HEIGHT_MM : WIDTH_MM) * MM;
  const H = (FLIP ? WIDTH_MM  : HEIGHT_MM) * MM;

  const M_TOP = 3 * MM, M_BOTTOM = 2 * MM, M_SIDE = 2 * MM;
  const CONTENT_H = H - M_TOP - M_BOTTOM;
  const THIRD = CONTENT_H / 3;
  const TOP_Y0 = H - M_TOP - THIRD;
  const TOP_Y1 = H - M_TOP;
  const MID_Y0 = H - M_TOP - 2 * THIRD;
  const MID_Y1 = H - M_TOP - THIRD;
  const BOT_Y0 = H - M_TOP - 3 * THIRD;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([W, H]);
  page.setRotation(degrees(0));

  const fR = await pdf.embedFont(StandardFonts.Helvetica);
  const fB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const T = (s)=> String(s ?? "");

  // QR payload (kompatibilní s tvými čtečkami)
  const qrPayload = {
    carton_code: carton_code ?? null,
    measured_weight: Number(weight ?? 0),
    prep_position: Number(position_to_show ?? 0),
    measurement_id: measurement_id ?? null,
    pallet_slot_id: pallet_slot_id ?? null,
  };
  const qrDataUrl = await QRCode.toDataURL(JSON.stringify(qrPayload), { margin: 2, scale: 8 });
  const qrImg = await pdf.embedPng(qrDataUrl);

  // horní třetina – QR
  const topWidth = W - 2 * M_SIDE;
  const topHeight = THIRD;
  const qrSize = Math.min(topHeight * 0.82, topWidth * 0.82);
  const qrX = M_SIDE + (topWidth - qrSize) / 2;
  const qrY = TOP_Y0 + (topHeight - qrSize) / 2;
  page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  // oddělovače
  page.drawRectangle({ x:M_SIDE, y: MID_Y1 - 1, width: W - 2*M_SIDE, height: 1.5, color: rgb(0,0,0) });
  page.drawRectangle({ x:M_SIDE, y: TOP_Y1 - 1, width: W - 2*M_SIDE, height: 1.5, color: rgb(0,0,0) });

  // prostřední třetina – texty
  const padX = M_SIDE + 2 * MM;
  const lineH = 6 * MM;
  let y = MID_Y1 - 2 * MM;

  const derived = splitFromCartonCode(carton_code);
  const batchVal  = batch_text || derived.batch || "";
  const itemVal   = item_code  || derived.item  || "";
  const indexVal  = (carton_index != null && carton_index !== "") ? String(carton_index) : (derived.index || "");

  if (batchVal) {
    y -= lineH;
    page.drawText(T(batchVal), { x: padX, y, size: 10, font: fB, color: rgb(0,0,0), maxWidth: W - padX - M_SIDE });
  }
  if (itemVal) {
    y -= lineH;
    page.drawText(T(itemVal), { x: padX, y, size: 10, font: fB, color: rgb(0,0,0), maxWidth: W - padX - M_SIDE });
  }
  if (indexVal) {
    y -= lineH;
    page.drawText(T(indexVal), { x: padX, y, size: 10, font: fB, color: rgb(0,0,0), maxWidth: W - padX - M_SIDE });
  }
  if (Number.isFinite(Number(weight))) {
    y -= lineH;
    page.drawText(`${Number(weight).toFixed(3)} kg`, { x: padX, y, size: 12, font: fB, color: rgb(0,0,0) });
  }
  if (slot_name) {
    y -= lineH;
    const value = T(slot_name);
    let fs = 18;
    while (fs > 10) {
      const w = fB.widthOfTextAtSize(value, fs);
      if (w <= (W - padX - M_SIDE)) break;
      fs -= 1;
    }
    page.drawText(value, { x: padX, y, size: fs, font: fB, color: rgb(0,0,0) });
  }

  // spodní třetina – velká pozice (pokud používáš)
  const isRK = Number(position_to_show) === 0;
  const posText = isRK ? "RK" : String(position_to_show ?? "");
  if (posText) {
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
  }

  return await pdf.saveAsBase64({ dataUri: false });
}
