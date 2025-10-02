// src/utils/labelPrint.js
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import axios from 'axios';

const AGENT_BASE  = process.env.REACT_APP_AGENT_URL  || 'http://127.0.0.1:4321';
const AGENT_TOKEN = process.env.REACT_APP_AGENT_TOKEN || 'super_tajne';

const agent = axios.create({
  baseURL: AGENT_BASE,
  headers: { 'x-agent-token': AGENT_TOKEN, 'Content-Type': 'application/json' }
});

export async function buildLabelPdfBase64({ ean, lot, packageNo, weightKg, userId, recordId }) {
  const doc = new jsPDF({ unit: 'mm', format: [50, 70] });

  const payload = {
    v: 1,
    ean: String(ean || ''),
    lot: String(lot || ''),
    pkg: String(packageNo || ''),
    wkg: Number(Number(weightKg || 0).toFixed(3)),
    uid: String(userId || ''),
    rec: String(recordId || '')
  };
  const qr = await QRCode.toDataURL(JSON.stringify(payload), { errorCorrectionLevel: 'M', margin: 0, scale: 4 });

  doc.setFontSize(9);
  doc.text(`EAN: ${payload.ean}`, 4, 6);
  doc.text(`Šarže: ${payload.lot}`, 4, 12);
  doc.text(`Balík: ${payload.pkg}`, 4, 18);
  doc.text(`Váha: ${payload.wkg} kg`, 4, 24);

  doc.addImage(qr, 'PNG', 4, 28, 42, 42);

  return btoa(doc.output('arraybuffer'));
}

export async function buildErrorLabelPdfBase64({ ean, lot, packageNo, weightKg, userId, recordId, refKg, diffKg, tolKg }) {
  const doc = new jsPDF({ unit: 'mm', format: [50, 70] });

  const payload = {
    v: 1, err: 1,
    ean: String(ean || ''),
    lot: String(lot || ''),
    pkg: String(packageNo || ''),
    wkg: Number(Number(weightKg || 0).toFixed(3)),
    uid: String(userId || ''),
    rec: String(recordId || '')
  };
  const qr = await QRCode.toDataURL(JSON.stringify(payload), { errorCorrectionLevel: 'M', margin: 0, scale: 4 });

  // hlavička "KONTROLA"
  doc.setFontSize(18);
  doc.text('KONTROLA', 25, 9, { align: 'center' });

  doc.setFontSize(9);
  doc.text(`EAN: ${payload.ean}`, 4, 16);
  doc.text(`Šarže: ${payload.lot}`, 4, 22);
  doc.text(`Balík: ${payload.pkg}`, 4, 28);

  doc.text(`Naměřeno: ${payload.wkg} kg`, 4, 36);
  doc.text(`Ref.: ${Number(refKg).toFixed(3)} kg`, 4, 42);
  doc.text(`Rozdíl: ${Number(diffKg).toFixed(3)} kg`, 4, 48);
  doc.text(`Tolerance: ±${Number(tolKg).toFixed(3)} kg`, 4, 54);

  doc.addImage(qr, 'PNG', 30, 36, 16, 16);

  return btoa(doc.output('arraybuffer'));
}

export async function printPdfBase64(pdfBase64, options = {}) {
  await agent.post('/print', { pdfBase64, options }); // { copies, printer, pages... }
}
