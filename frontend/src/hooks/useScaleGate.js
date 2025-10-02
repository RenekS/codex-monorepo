// Gate nad skenerem podle váhy:
// - sken povolen jen při stabilní 0 kg
// - po uložení/tisku se skener zamkne a ODEMKNE SE 1000 ms POTÉ, CO SE POPRVÉ OBJEVÍ STABILNÍ NULA
//
// ENV (volitelné):
//   REACT_APP_SCALE_ZERO_EPS   — tolerance pro "≈ 0 kg" (default 0.02)

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useScaleStream from "../components/scanweigh/useScaleStream";

const ZERO_EPS     = Number(process.env.REACT_APP_SCALE_ZERO_EPS || 0.02); // kg
const ZERO_HOLD_MS = 200; // natvrdo: 1 s po prvním výskytu nuly

export default function useScaleGate() {
  // posloucháme váhu globálně (true = stream běží vždy)
  const { live } = useScaleStream(true);

  const [locked, setLocked] = useState(false);
  const timerRef = useRef(null);

  // stabilní nula (pokud chceš ignorovat stabilitu, odeber "&& !!live?.stable")
  const isZeroNow = useMemo(() => {
    const v = Number(live?.measurement ?? NaN);
    return Number.isFinite(v) && Math.abs(v) <= ZERO_EPS && !!live?.stable;
  }, [live?.measurement, live?.stable]);

  // sken je dovolen jen když nejsme locked a je stabilní nula
  const canAcceptScan = !locked && isZeroNow;

  // zavoláš po úspěšném uložení/tisku → zamkne skener,
  // odemknutí se spustí až při PRVNÍM výskytu stabilní nuly + 1000 ms (edge-trigger)
  const lockUntilZero = useCallback(() => {
    setLocked(true);
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    // vlastní „odpálení“ odemknutí řeší efekt níže při prvním isZeroNow === true
  }, []);

  // když je locked a objeví se nula poprvé → nastartuj jednorázový timeout na ZERO_HOLD_MS
  useEffect(() => {
    if (!locked) return;

    if (isZeroNow && !timerRef.current) {
      timerRef.current = setTimeout(() => {
        setLocked(false);
        timerRef.current = null;
      }, ZERO_HOLD_MS);
    }
    // POZN.: pokud nula spadne, timeout běží dál (edge-trigger dle požadavku)
  }, [locked, isZeroNow]);

  // úklid
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return { live, canAcceptScan, lockUntilZero, locked, isZeroNow };
}
