// src/hooks/useBarcodeScanner.js
import { useEffect, useRef } from 'react';

/**
 * Globální čtečka "keyboard wedge" skenerů.
 * - sbírá rychlé keydown události do bufferu
 * - na Enter zavolá callback s načteným kódem
 * - ZÁSADNÍ: preventDefault + stopPropagation v capture fázi,
 *   aby Enter neodklikl žádné tlačítko (např. "Další" v modalu)
 *
 * Použití: useBarcodeScanner(onScan)
 */
export default function useBarcodeScanner(
  onScan,
  {
    enabled = true,
    bufferTimeoutMs = 80,   // typická mezera mezi znaky ze skeneru je velmi krátká
    minLength = 1,          // povolíme i 1 znak (některé EANy posílají prefixy)
  } = {}
) {
  const bufRef = useRef('');
  const tRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const resetBuffer = () => {
      bufRef.current = '';
      if (tRef.current) {
        clearTimeout(tRef.current);
        tRef.current = null;
      }
    };

    const flush = () => {
      const code = bufRef.current.trim();
      resetBuffer();
      if (code.length >= minLength && typeof onScan === 'function') {
        try { onScan(code); } catch (e) { /* noop */ }
      }
    };

    const onKeyDownCapture = (e) => {
      // pokud je spuštěný IME nebo je to systémová kombinace, ignoruj
      if (e.isComposing) return;

      // zachytíme úplně vše v capture fázi, aby Enter neodklikával tlačítka
      const key = e.key;

      // ENTER => dokončit scan
      if (key === 'Enter') {
        // blokuj default i bublání (zabrání "kliknutí" na focused button)
        e.preventDefault();
        e.stopPropagation();
        flush();

        // vyčisti fokus z případného tlačítka
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
          document.activeElement.blur();
        }
        return;
      }

      // ESC jen vyčistí buffer (ať nevyvolá nic v UI)
      if (key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        resetBuffer();
        return;
      }

      // ignoruj modifikátory, navigační klávesy apod.
      if (
        key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta' ||
        key === 'CapsLock' || key === 'Tab' || key === 'ArrowLeft' || key === 'ArrowRight' ||
        key === 'ArrowUp' || key === 'ArrowDown' || key === 'Home' || key === 'End' ||
        key === 'PageUp' || key === 'PageDown' || key === 'Insert'
      ) {
        return;
      }

      // běžný znak z klávesnice/skeneru
      const ch = key.length === 1 ? key : '';
      if (ch) {
        // pokud je fokus v editovatelném prvku (input/textarea/contentEditable),
        // ale nechceme psát do pole, stejně to zachytíme.
        // Zabráníme tak side-efektům (psaní do inputu + odeslání formuláře).
        e.preventDefault();
        e.stopPropagation();

        bufRef.current += ch;

        if (tRef.current) clearTimeout(tRef.current);
        tRef.current = setTimeout(() => {
          // pokud by skener neposlal Enter (někdy se to stává),
          // po timeoutu to bereme jako ukončený kód
          flush();
        }, bufferTimeoutMs);
      }
    };

    // capture = true je klíčové
    window.addEventListener('keydown', onKeyDownCapture, true);

    return () => {
      window.removeEventListener('keydown', onKeyDownCapture, true);
      resetBuffer();
    };
  }, [enabled, bufferTimeoutMs, minLength, onScan]);
}
