// Jednotná konfigurace prostředí pro NP modul
export const AGENT_BASE = process.env.REACT_APP_AGENT_URL || "http://127.0.0.1:4321";

export const USER_ID    = Number(process.env.REACT_APP_USER_ID || 1);

export const LABEL_PRINTER = process.env.REACT_APP_LABEL_PRINTER || "Citizen CL-S521";
export const PRINT_TOKEN   = process.env.REACT_APP_PRINT_TOKEN   || null;

// 1 = swap šířka/výška (pokud driver převrací orientaci)
export const FLIP = String(process.env.REACT_APP_LABEL_FLIP || "0") === "1";

export const UI_DECIMALS = 3;     // zobrazení živé váhy
export const RK_CODE_API = 0;     // kód pro ruční kontrolu v API
export const RK_BADGE    = "RK";  // text na štítku při RK