import { AGENT_BASE, LABEL_PRINTER, PRINT_TOKEN } from "../components/scanweigh/constants";

async function postAgent(path, body) {
  const headers = { "Content-Type": "application/json" };
  if (PRINT_TOKEN) headers["x-print-token"] = PRINT_TOKEN;
  const r = await fetch(`${AGENT_BASE}${path}`, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
}

export async function printPdfBase64ToLabel(printerPdfBase64) {
  return postAgent("/print-pdf", {
    pdfBase64: printerPdfBase64,
    printer: LABEL_PRINTER,
    options: {
      orientation: "portrait",
      paper: { widthMm: 50, heightMm: 100 },
      scale: "noscale",
      silent: true
    }
  });
}
