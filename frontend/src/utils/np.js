export const normalizeEAN = (s) => String(s || "").trim().replace(/^0+/, "");

export const computeOrderedBoxes = (line) => {
  const pcs = Number(line?.objednano || 0);
  const per = Number(line?.tk_ks_v_krabici || line?.pcs_per_carton || 0);
  if (!isFinite(pcs) || !isFinite(per) || per <= 0) return 0;
  return Math.ceil(pcs / per);
};
