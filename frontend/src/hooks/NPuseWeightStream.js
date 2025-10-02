import { useEffect, useRef, useState } from "react";
import { AGENT_BASE } from "../api/NPconfig";

/**
 * Stream/polling hodnot z váhy s náhradním pollingem a určováním stability.
 */
export default function NPuseWeightStream(open) {
  const [live, setLive] = useState({ measurement: null, stable: false });
  const esRef = useRef(null);
  const pollRef = useRef(null);
  const lastValRef = useRef(null);

  const stableLike = (val) => {
    const prev = lastValRef.current;
    lastValRef.current = val;
    if (prev == null) return false;
    return Math.abs(val - prev) <= 0.01;
  };

  const handleIncoming = (raw) => {
    let val = Number(raw?.measurement ?? NaN);
    if (!isFinite(val)) return;
    const unit = (raw?.unit || "kg").toLowerCase();
    if (unit === "g") val /= 1000;
    const vendorStable = !!raw?.stable;
    const uiStable = vendorStable || stableLike(val);
    setLive({ measurement: val, stable: uiStable });
  };

  function startPolling() {
    if (pollRef.current) return;
    const url = `${AGENT_BASE}/weight`;
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        handleIncoming(await r.json());
      } catch {}
    }, 150);
  }

  function stopPolling() {
    if (!pollRef.current) return;
    clearInterval(pollRef.current);
    pollRef.current = null;
  }

  useEffect(() => {
    if (!open) return () => {};

    lastValRef.current = null;
    let es;
    try {
      es = new EventSource(`${AGENT_BASE}/stream`);
      esRef.current = es;
      es.onerror = () => { try { es.close(); } catch {}; esRef.current = null; startPolling(); };
      es.onmessage = (e) => { try { handleIncoming(JSON.parse(e.data)); } catch {} };
    } catch {
      startPolling();
    }

    return () => {
      try { esRef.current?.close?.(); } catch {}
      esRef.current = null;
      stopPolling();
    };
  }, [open]);

  return { live };
}