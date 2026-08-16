"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/**
 * Page-load intro: preloader met gebrand watermerk → boog-masked reveal →
 * inhoud verschijnt. De child-sectie leest de fase via useIntroPhase() en
 * start zijn eigen entrance zodra de boog opengaat.
 *
 * prefers-reduced-motion slaat de hele intro over: de fase springt meteen
 * op "done" en de preloader wordt niet getoond.
 */
type Phase = "load" | "opening" | "done";

const IntroPhaseCtx = createContext<Phase>("done");

export const useIntroPhase = () => useContext(IntroPhaseCtx);

export function IntroReveal({
  brand,
  children,
  hold = 1150,
  open = 1200,
}: {
  /** Wat er als watermerk in de preloader staat, meestal de merknaam. */
  brand: string;
  children: ReactNode;
  /** ms dat de preloader blijft staan voor de boog opengaat */
  hold?: number;
  /** ms duur van de boog-reveal */
  open?: number;
}) {
  const [phase, setPhase] = useState<Phase>("load");

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setPhase("done");
      return;
    }
    const t1 = setTimeout(() => setPhase("opening"), hold);
    const t2 = setTimeout(() => setPhase("done"), hold + open);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [hold, open]);

  return (
    <IntroPhaseCtx.Provider value={phase}>
      <div className={`bbb-intro-preloader bbb-intro-${phase}`} aria-hidden="true">
        <span className="bbb-intro-frame" />
        <span className="bbb-intro-watermark">{brand}</span>
      </div>
      <div className={`bbb-intro-stage bbb-intro-${phase}`}>{children}</div>
    </IntroPhaseCtx.Provider>
  );
}

export default IntroReveal;
