// src/hooks/useScannerInput.js
import { useEffect, useRef, useState } from 'react';

export default function useScannerInput({
  enabled = true,
  onScan,
  minLength = 6,
  idleMs = 50,              // jak dlouhá pauza znamená konec skenu
  suffixKeys = ['Enter', 'NumpadEnter', 'Tab'],
  autoFocus = true,
} = {}) {
  const inputRef = useRef(null);
  const bufRef = useRef('');
  const idleTimer = useRef(null);
  const lastTsRef = useRef(0);
  const [lastCode, setLastCode] = useState('');

  // finalize & reset
  const finalize = () => {
    const raw = bufRef.current.trim();
    bufRef.current = '';
    lastTsRef.current = 0;
    if (idleTimer.current) { clearTimeout(idleTimer.current); idleTimer.current = null; }
    if (raw.length >= minLength) {
      setLastCode(raw);
      onScan && onScan(raw);
    }
  };

  const scheduleIdle = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => finalize(), idleMs);
  };

  // Keep focus on hidden input
  useEffect(() => {
    if (!enabled || !autoFocus) return;
    const keepFocus = () => {
      if (document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }
    };
    const id = setInterval(keepFocus, 300);
    keepFocus();
    return () => clearInterval(id);
  }, [enabled, autoFocus]);

  // Handlers bound directly on the input
  const onInput = (e) => {
    if (!enabled) return;
    const v = e.currentTarget.value || '';
    if (!v) return;
    const now = performance.now();
    // Pokud mezi znaky nebyla dlouhá pauza, append
    if (lastTsRef.current && now - lastTsRef.current > idleMs * 3) {
      // Velká mezera → považuj za nový scan (předchozí finalize)
      finalize();
    }
    bufRef.current += v;
    e.currentTarget.value = ''; // vyprázdni input po přebrání
    lastTsRef.current = now;
    scheduleIdle();
  };

  const onPaste = (e) => {
    if (!enabled) return;
    const data = e.clipboardData?.getData('text') ?? '';
    if (data) {
      // paste často doručí celý kód najednou
      bufRef.current += data;
      scheduleIdle();
      e.preventDefault();
    }
  };

  // Fallback keydown (pro zachycení Enter/Tab jako suffix)
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e) => {
      if (!enabled) return;
      const key = e.key;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // ukončovací klávesy
      if (suffixKeys.includes(key)) {
        if (bufRef.current.length >= minLength) {
          e.preventDefault();
          e.stopPropagation();
          finalize();
        } else {
          bufRef.current = '';
          lastTsRef.current = 0;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enabled, minLength, suffixKeys]);

  // komponenta k vložení do JSX
  const ScannerInput = (props) => (
    <input
      ref={inputRef}
      type="text"
      inputMode="none"
      autoComplete="off"
      autoCorrect="off"
      spellCheck="false"
      style={{
        position: 'fixed',
        opacity: 0,
        width: 1,
        height: 1,
        pointerEvents: 'none',
        left: -9999,
        top: -9999
      }}
      onInput={onInput}
      onPaste={onPaste}
      {...props}
    />
  );

  return { ScannerInput, lastCode };
}
