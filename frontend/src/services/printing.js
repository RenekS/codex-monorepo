// =============================================================
// File: src/services/printing.js
// =============================================================
import { NP_buildLabelPdfBase64 } from '../utils/NP_buildLabel';
import { sendLabelPdfToAgent } from '../utils/printAgent';
import { suffixInt } from '../utils/inventoryHelpers';

export async function printCreatedLabels(createdDetails) {
  for (const row of createdDetails) {
    const pdfB64 = await NP_buildLabelPdfBase64({
      carton_code: row.carton_code,
      measurement_id: row.id,
      weight: 0,
      position_to_show: 0,
      pallet_slot_id: row.slot_id,
      item_code: row.product_code,
      batch_text: row.carton_code?.split('-')[0] || '',
      slot_name: row.slot_name || '',
      carton_index: row.carton_index
    });
    await sendLabelPdfToAgent(pdfB64, {
      printer: process.env.REACT_APP_LABEL_PRINTER,
      copies: 1,
      widthMm: 50,
      heightMm: 100
    });
  }
}

export async function printNewCartonsFallback({ scans, slotId, getSlotName }) {
  if (Array.isArray(scans) && scans.length) {
    const toPrint = scans.filter(c => typeof c === 'string').map(code => ({
      id: null,
      carton_code: code,
      product_code: (code.split('-')[1] || ''),
      slot_id: slotId,
      slot_name: getSlotName(slotId),
      carton_index: (code.match(/(\d+)\s*$/)?.[1] ? parseInt(code.match(/(\d+)\s*$/)[1],10) : null)
    }));
    if (toPrint.length) { await printCreatedLabels(toPrint); return true; }
  }
  return false;
}

export async function printCartonRow({ cartonRow, selectedSlotId, getSlotName }) {
  const idx = suffixInt(cartonRow.carton_code);
  const pdfB64 = await NP_buildLabelPdfBase64({
    carton_code: cartonRow.carton_code,
    measurement_id: cartonRow.id ?? null,
    weight: 0,
    position_to_show: 0,
    pallet_slot_id: Number(selectedSlotId) || null,
    item_code: cartonRow.product_code,
    slot_name: getSlotName(selectedSlotId),
    carton_index: idx ?? undefined
  });
  await sendLabelPdfToAgent(pdfB64, {
    printer: process.env.REACT_APP_LABEL_PRINTER,
    copies: 1,
    widthMm: 50,
    heightMm: 100
  });
}

export async function printScanRow({ row, selectedSlotId, getSlotName, parseProdFromCode, looksLikeQr, suffixInt }) {
  const code = looksLikeQr(row.raw) ? row.raw : (row.preview_carton_code || `EAN-${row.raw}`);
  const pdfB64 = await NP_buildLabelPdfBase64({
    carton_code: code,
    measurement_id: row.measurementId ?? null,
    weight: 0,
    position_to_show: 0,
    pallet_slot_id: Number(selectedSlotId) || null,
    item_code: row.product_code || parseProdFromCode(code),
    slot_name: getSlotName(selectedSlotId),
    carton_index: suffixInt(code) ?? undefined
  });
  await sendLabelPdfToAgent(pdfB64, {
    printer: process.env.REACT_APP_LABEL_PRINTER,
    copies: 1,
    widthMm: 50,
    heightMm: 100
  });
}

// ---- Helpers for PDF download ----
function b64ToBlobPdf(b64) {
  try {
    const clean = String(b64 || '').replace(/^data:application\/pdf;?base64,?/i, '');
    const byteChars = atob(clean);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: 'application/pdf' });
  } catch (e) {
    console.error('b64ToBlobPdf error', e);
    return new Blob([], { type: 'application/pdf' });
  }
}

function safeFileName(s) {
  return String(s || 'label').replace(/[^a-z0-9._-]+/gi, '_').slice(0, 120);
}

export async function downloadPdfBase64(b64, baseName = 'label') {
  try {
    const blob = b64ToBlobPdf(b64);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeFileName(baseName) + '.pdf';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  } catch (e) {
    console.error('downloadPdfBase64 error', e);
  }
}

// ---- Download label as PDF (no print) ----
export async function downloadCartonRowPdf({ cartonRow, selectedSlotId, getSlotName }) {
  const idx = suffixInt(cartonRow.carton_code);
  const pdfB64 = await NP_buildLabelPdfBase64({
    carton_code: cartonRow.carton_code,
    measurement_id: cartonRow.id ?? null,
    weight: 0,
    position_to_show: 0,
    pallet_slot_id: Number(selectedSlotId) || null,
    item_code: cartonRow.product_code,
    slot_name: getSlotName(selectedSlotId),
    carton_index: idx ?? undefined
  });
  await downloadPdfBase64(pdfB64, `label_${cartonRow.carton_code || 'carton'}`);
}

export async function downloadScanRowPdf({ row, selectedSlotId, getSlotName, parseProdFromCode, looksLikeQr, suffixInt }) {
  const code = looksLikeQr(row.raw) ? row.raw : (row.preview_carton_code || `EAN-${row.raw}`);
  const pdfB64 = await NP_buildLabelPdfBase64({
    carton_code: code,
    measurement_id: row.measurementId ?? null,
    weight: 0,
    position_to_show: 0,
    pallet_slot_id: Number(selectedSlotId) || null,
    item_code: row.product_code || parseProdFromCode(code),
    slot_name: getSlotName(selectedSlotId),
    carton_index: suffixInt(code) ?? undefined
  });
  await downloadPdfBase64(pdfB64, `label_${code}`);
}
