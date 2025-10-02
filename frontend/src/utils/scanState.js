// src/utils/scanState.js
export function getScanState(scanned = 0, ordered = 0) {
  const s = Number(scanned) || 0;
  const o = Number(ordered) || 0;
  if (o <= 0 && s === 0) return "none";      // nic k objednání, nic naskenováno
  if (s === 0)            return "none";      // nenaskenováno
  if (s < o)              return "partial";   // rozpracováno
  if (s === o)            return "exact";     // přesně splněno
  return "over";                               // přeskenováno
}

// jemné (pastel) barvy na pozadí řádku / tlačítka
export const STATE_BG = {
  none    : "transparent",  // bílé/neutrální
  partial : "#fff3e0",      // oranžová (MUI Orange 50)
  exact   : "#e8f5e9",      // zelená   (MUI Green 50)
  over    : "#ffebee",      // červená  (MUI Red 50)
};

// barva textu/badge pro kontrast (volitelně)
export const STATE_FG = {
  none    : "inherit",
  partial : "#ef6c00",      // Orange 800
  exact   : "#2e7d32",      // Green 800
  over    : "#c62828",      // Red 800
};
