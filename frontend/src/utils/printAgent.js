// src/utils/printAgent.js
export async function sendLabelPdfToAgent(
  pdfBase64,
  {
    printer = process.env.REACT_APP_LABEL_PRINTER,
    copies = 1,
    widthMm = 50,
    heightMm = 100,
    base =
      process.env.REACT_APP_AGENT_URL ||
      process.env.REACT_APP_AGENT_BASE ||
      "http://127.0.0.1:4321",
    token =
      process.env.REACT_APP_AGENT_TOKEN ||
      process.env.REACT_APP_PRINT_TOKEN ||
      ""
  } = {}
) {
  // primárně /print (x-agent-token)
  try {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["x-agent-token"] = token;
    const r = await fetch(`${base}/print`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        pdfBase64,
        options: {
          copies,
          printer,
          paper: { widthMm, heightMm },
          orientation: "portrait",
          silent: true
        }
      })
    });
    if (r.ok) return r.json();
  } catch {}

  // fallback /print-pdf (x-print-token)
  const headers2 = { "Content-Type": "application/json" };
  if (token) headers2["x-print-token"] = token;
  const r2 = await fetch(`${base}/print-pdf`, {
    method: "POST",
    headers: headers2,
    body: JSON.stringify({
      pdfBase64,
      printer,
      options: {
        copies,
        paper: { widthMm, heightMm },
        orientation: "portrait",
        silent: true
      }
    })
  });
  if (!r2.ok) throw new Error(`/print-pdf ${r2.status}`);
  return r2.json();
}
