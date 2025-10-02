import { useEffect, useRef, useState } from "react";
import { AGENT_BASE } from "./constants";

export default function useScaleStream(open) {
  const [live, setLive] = useState({ measurement: null, stable: false });
  const esRef = useRef(null);
  const pollTimerRef = useRef(null);
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
    if (pollTimerRef.current) return;
    const url = `${AGENT_BASE}/weight`;
    pollTimerRef.current = setInterval(async () => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const data = await r.json();
        handleIncoming(data);
      } catch {}
    }, 150);
  }
  function stopPolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  useEffect(() => {
    if (!open) return;
    lastValRef.current = null;
    const url = `${AGENT_BASE}/stream`;
    let es;
    try {
      es = new EventSource(url);
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
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return { live };
}
