// =============================================================
// File: src/hooks/useScanBuffer.js
// =============================================================
import { useEffect, useRef, useState } from 'react';

export default function useScanBuffer({
  enabled = true,
  onScan,
  minLength = 6,
  terminatorKeys = new Set(['Enter', 'NumpadEnter', 'Tab']),
  SCAN_CHAR_INTERVAL_MS = 28,
  SCAN_IDLE_MS = 60
}) {
  const bufRef = useRef('');
  const lastTsRef = useRef(0);
  const likelyScanRef = useRef(false);
  const idleTimerRef = useRef(null);
  const [lastCode, setLastCode] = useState('');

  useEffect(() => {
    if (!enabled) return;

    const finalize = () => {
      const code = bufRef.current;
      bufRef.current = '';
      likelyScanRef.current = false;
      lastTsRef.current = 0;
      if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
      const trimmed = code.trim();
      if (trimmed.length >= minLength) {
        setLastCode(trimmed);
        onScan && onScan(trimmed);
      }
    };

    const scheduleIdle = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        if (bufRef.current.length >= minLength) finalize();
        else { bufRef.current = ''; likelyScanRef.current = false; lastTsRef.current = 0; }
      }, SCAN_IDLE_MS);
    };

    const onKey = (e) => {
      if (!enabled) return;
      const t = e.target;
      const isEditable = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const key = e.key;
      if (terminatorKeys.has(key)) {
        if (bufRef.current.length >= minLength) { e.preventDefault(); e.stopPropagation(); finalize(); return; }
        bufRef.current = ''; likelyScanRef.current = false; lastTsRef.current = 0; return;
      }
      if (key && key.length === 1) {
        const now = e.timeStamp || performance.now();
        const gap = now - (lastTsRef.current || 0);
        if (bufRef.current.length === 0) { likelyScanRef.current = true; }
        else if (gap > SCAN_CHAR_INTERVAL_MS * 3) { bufRef.current = ''; likelyScanRef.current = true; }
        bufRef.current += key; lastTsRef.current = now;
        if (gap <= SCAN_CHAR_INTERVAL_MS || likelyScanRef.current) { e.preventDefault(); e.stopPropagation(); }
        scheduleIdle();
      }
    };

    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
  }, [enabled, onScan, minLength, terminatorKeys, SCAN_CHAR_INTERVAL_MS, SCAN_IDLE_MS]);

  return { lastCode };
}
