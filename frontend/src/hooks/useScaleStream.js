// src/hooks/useScaleStream.js
import { useEffect, useRef, useState } from "react";

/**
 * Čte živou váhu ze "scale agent" serveru.
 * Preferuje SSE (GET /stream), jinak přepne na polling (GET /weight).
 *
 * ENV (volitelné):
 *  - REACT_APP_SCALE_BASE nebo REACT_APP_AGENT_BASE
 *    → např. http://localhost:4321
 */
const SCALE_BASE =
  process.env.REACT_APP_SCALE_BASE ||
  process.env.REACT_APP_AGENT_BASE ||
  "http://localhost:4321";

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function useScaleStream({ pollMs = 300 } = {}) {
  const [live, setLive] = useState(null); // { weight:number|null, stable:boolean, ts:number, raw:any }
  const [connected, setConnected] = useState(false);

  const esRef = useRef(null);
  const pollRef = useRef(null);
  const cancelledRef = useRef(false);

  const stopAll = () => {
    if (esRef.current) {
      try { esRef.current.close(); } catch {}
      esRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = () => {
    if (pollRef.current) return;
    const tick = async () => {
      try {
        const r = await fetch(`${SCALE_BASE}/weight`, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        if (cancelledRef.current) return;
        setConnected(true);
        setLive({
          weight: toNum(d.weight),
          stable: !!d.stable,
          ts: d.ts ? Number(d.ts) : Date.now(),
          raw: d,
        });
      } catch (_) {
        if (cancelledRef.current) return;
        setConnected(false);
      }
    };
    tick();
    pollRef.current = setInterval(tick, pollMs);
  };

  const startSSE = () => {
    if (typeof EventSource === "undefined") return false;
    try {
      const es = new EventSource(`${SCALE_BASE}/stream`);
      esRef.current = es;

      es.onopen = () => {
        if (cancelledRef.current) return;
        setConnected(true);
      };

      es.onerror = () => {
        // SSE selhalo → přepni na polling
        if (cancelledRef.current) return;
        try { es.close(); } catch {}
        esRef.current = null;
        setConnected(false);
        startPolling();
      };

      es.onmessage = (e) => {
        if (cancelledRef.current) return;
        try {
          const d = JSON.parse(e.data);
          setConnected(true);
          setLive({
            weight: toNum(d.weight),
            stable: !!d.stable,
            ts: d.ts ? Number(d.ts) : Date.now(),
            raw: d,
          });
        } catch {
          // ignoruj špatný paket
        }
      };

      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    cancelledRef.current = false;

    // preferuj SSE, jinak polling
    const ok = startSSE();
    if (!ok) startPolling();

    const onVis = () => {
      // šetři baterii při skrytém tabu (jen pro polling)
      if (document.visibilityState === "hidden" && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      } else if (document.visibilityState === "visible" && !esRef.current && !pollRef.current) {
        startPolling();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelledRef.current = true;
      document.removeEventListener("visibilitychange", onVis);
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollMs, SCALE_BASE]);

  return { live, connected, base: SCALE_BASE };
}
