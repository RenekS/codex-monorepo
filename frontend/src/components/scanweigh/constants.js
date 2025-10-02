export const AGENT_BASE = process.env.REACT_APP_AGENT_URL || "http://127.0.0.1:4321";
export const API_BASE   = process.env.REACT_APP_API_URL   || "";
export const USER_ID    = Number(process.env.REACT_APP_USER_ID || 1);

export const LABEL_PRINTER = process.env.REACT_APP_LABEL_PRINTER || "Citizen CL-S521";
export const PRINT_TOKEN   = process.env.REACT_APP_PRINT_TOKEN   || null;

// 1 = prohodit šířku/výšku při renderu PDF (kvůli ovladači)
export const FLIP = String(process.env.REACT_APP_LABEL_FLIP || "0") === "1";

export const UI_DECIMALS = 3;

// kód pro RK do API a badge do UI
export const RK_CODE_API = 0;
export const RK_BADGE    = "RK";

// tisková velikost (mm)
export const PAPER_MM = { width: 50, height: 100 };

// výchozí tolerance a minimální nárůst
export const DEFAULT_TOL_KG = 0.20;
export const DEFAULT_MIN_PLACED_KG = 0.20;

// max pozice pro auto-obsazování (dřív bylo 20) – můžeš přepsat ENV
export const MAX_PREP_POSITION = Number(process.env.REACT_APP_PREP_POS_MAX || 200);
