"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Transitie 101, zware variant — de scroll-mechaniek uit de LOFED-site,
 * geport naar React.
 *
 * Eén tall stage van `stops` × 100vh met daarin een sticky pin. Alle panelen
 * liggen absoluut gestapeld in die pin; hun opacity en transform worden per
 * frame door JS gezet. Géén CSS-transitions op eigenschappen die de RAF-loop
 * ook aanraakt — die vechten met elkaar en dat stottert.
 *
 * Eén gesture = één stop: de wheel wordt volledig gehijackt en per gesture
 * tweent `window.scrollTo` met easeInOutCubic naar de volgende hele stop.
 *
 * Verschil met SnapScroll: die snapt hele secties in de gewone documentstroom
 * en laat de pagina daarna vrij lopen. Stage pint de panelen op elkaar en kent
 * twee tempo's. Kies SnapScroll als de secties gewoon onder elkaar staan.
 *
 * Bij `prefers-reduced-motion` valt alles terug op gewone stapeling en normale
 * scroll; de panelen renderen dan hun ruststand, want die staat in de CSS.
 */

import {
  DUUR_SNEL_DESKTOP,
  DUUR_SNEL_MOBIEL,
  DUUR_STOP_DESKTOP,
  DUUR_STOP_MOBIEL,
  MOBIEL_BREEDTE,
  ONDERBREEK_VANAF,
  SETTLE,
  SETTLE_SNEL,
  clamp,
  easeInOutCubic,
} from "./easing";

type StageWaarde = {
  abonneer: (cb: (viz: number) => void) => () => void;
  stops: number;
  statisch: boolean;
};

const StageContext = createContext<StageWaarde | null>(null);

/**
 * Draait mee in de RAF-loop van de stage. `viz` is de gelerpte scrollpositie in
 * stops: 0 = eerste paneel volledig in beeld, 1.5 = halverwege de tweede overgang.
 * Schrijf hierin rechtstreeks naar de DOM — geen React-state, dat zou per frame
 * een re-render kosten.
 */
export function useStageFrame(cb: (viz: number) => void) {
  const ctx = useContext(StageContext);
  const bewaard = useRef(cb);
  bewaard.current = cb;

  useEffect(() => {
    if (!ctx || ctx.statisch) return;
    return ctx.abonneer((viz) => bewaard.current(viz));
  }, [ctx]);
}

/**
 * True zodra de bezoeker `prefers-reduced-motion` aan heeft staan. De panelen
 * zetten zichzelf dan in de gewone documentstroom in plaats van gestapeld in de pin.
 */
export function useStageStatisch() {
  return useContext(StageContext)?.statisch ?? false;
}

/** Springt direct naar een stop, zonder de tussenliggende panelen te laten flitsen. */
let springExtern: ((index: number) => void) | null = null;

/** Voor navigatie buiten de stage om, zoals de header. */
export function stageSpringNaar(index: number) {
  springExtern?.(index);
}

/**
 * Zet de hijack helemaal op slot. Nodig zodra er een modaal venster over de stage
 * ligt: `data-stage-scroller` geeft de wheel alleen terug zolang het paneel zélf
 * nog kan scrollen, dus zonder dit slot pagineert de stage door zodra het
 * formulier onderaan staat — en dan beweegt de site áchter de dialoog.
 */
let stageOpSlot = false;

export function zetStageSlot(op: boolean) {
  stageOpSlot = op;
}

export default function Stage({
  stops,
  snelleStops,
  children,
}: {
  stops: number;
  /**
   * Inclusief bereik `[eerste, laatste]` waarbinnen een stap als "binnen dezelfde
   * sectie" telt: kortere tween, kortere settle en een volgend gebaar mag de
   * lopende tween overnemen. Stappen die het bereik in- of uitgaan blijven een
   * volwaardige sectiewissel.
   */
  snelleStops?: [number, number];
  children: ReactNode;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [statisch, setStatisch] = useState(false);
  const luisteraars = useRef(new Set<(viz: number) => void>());
  // Uit elkaar getrokken: een array-prop krijgt elke render een nieuwe identiteit
  // en zou het effect dan onnodig opnieuw opbouwen.
  const snelVan = snelleStops?.[0];
  const snelTot = snelleStops?.[1];

  const abonneer = useCallback((cb: (viz: number) => void) => {
    luisteraars.current.add(cb);
    return () => {
      luisteraars.current.delete(cb);
    };
  }, []);

  useEffect(() => {
    const stil = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (stil.matches) {
      setStatisch(true);
      return;
    }

    const stage = stageRef.current;
    if (!stage) return;

    // Nooit door nul delen of de stage op hoogte 0 zetten: een viewport die
    // kortstondig 0 rapporteert (verborgen tab, herstellend venster) zou anders
    // de hele pagina laten inklappen en de scrollpositie wissen.
    const vh = () => window.innerHeight || 1;
    const mobiel = () => window.innerWidth < MOBIEL_BREEDTE;

    /**
     * Document-Y waar de stage begint. Sinds de hero erboven staat is dat niet
     * meer 0 — alle stop-posities rekenen vanaf hier.
     */
    const top = () => stage.getBoundingClientRect().top + window.scrollY;

    /**
     * Staat de stage aan de beurt? Erboven (in de hero) laten we de browser
     * gewoon zijn werk doen; anders kun je nooit meer terug naar boven.
     */
    const inStage = () => !stageOpSlot && window.scrollY >= top() - 4;

    let rawScroll = window.scrollY - top();
    let vizScroll = rawScroll / vh();
    let laatsteViz = -1;
    let doelStop = clamp(Math.round(rawScroll / vh()), 0, stops - 1);
    let tweent = false;
    let tweenEinde = 0;
    let tweenRAF = 0;
    let lusRAF = 0;
    let snapTimer = 0;

    /* Staat van de lopende tween — bepaalt of een volgend gebaar mag doorpakken. */
    let tweenSnel = false;
    let tweenT0 = 0;
    let tweenDuur = DUUR_STOP_DESKTOP;
    let settle = SETTLE;

    /** Ligt een stop binnen de sectie die op snel tempo mag? */
    const inSnelBereik = (stop: number) =>
      snelVan !== undefined && snelTot !== undefined && stop >= snelVan && stop <= snelTot;

    /** Een stap telt als snel zolang hij begint én eindigt binnen dezelfde sectie. */
    const isSnelleStap = (van: number, naar: number) =>
      inSnelBereik(van) && inSnelBereik(naar);

    const zetHoogte = () => {
      if (window.innerHeight < 1) return;
      stage.style.height = `${stops * vh()}px`;
    };
    zetHoogte();

    const verdeel = (viz: number) => {
      luisteraars.current.forEach((cb) => cb(viz));
    };

    /* ── RAF-loop: lerpt de zichtbare positie naar de echte scrollpositie ── */
    const lus = () => {
      // Tijdens een snelle stap trekt de lerp harder aan: met 0,16 zou de
      // crossfade achter een tween van 460ms aan blijven slepen en dan is de
      // winst weer weg.
      const factor = tweent && tweenSnel ? 0.32 : mobiel() ? 0.24 : 0.16;
      const ruw = rawScroll / vh();
      const verschil = ruw - vizScroll;
      vizScroll = Math.abs(verschil) < 0.002 ? ruw : vizScroll + verschil * factor;

      if (Math.abs(vizScroll - laatsteViz) > 0.0004) {
        verdeel(vizScroll);
        laatsteViz = vizScroll;
      }
      lusRAF = requestAnimationFrame(lus);
    };
    lusRAF = requestAnimationFrame(lus);
    verdeel(vizScroll);

    /* ── Sectie-tween: één gesture = precies één stop ── */
    const tweenNaar = (index: number) => {
      const doel = clamp(index, 0, stops - 1);
      const vanaf = doelStop;
      doelStop = doel;
      cancelAnimationFrame(tweenRAF);

      const startY = window.scrollY;
      const eindY = top() + doel * vh();
      if (Math.abs(eindY - startY) < 2) {
        // Al op de stop — de vlag nooit blijven laten hangen.
        tweent = false;
        tweenEinde = performance.now();
        return;
      }

      tweent = true;
      tweenSnel = isSnelleStap(vanaf, doel);
      settle = tweenSnel ? SETTLE_SNEL : SETTLE;
      const duur = tweenSnel
        ? mobiel()
          ? DUUR_SNEL_MOBIEL
          : DUUR_SNEL_DESKTOP
        : mobiel()
          ? DUUR_STOP_MOBIEL
          : DUUR_STOP_DESKTOP;
      const t0 = performance.now();
      tweenT0 = t0;
      tweenDuur = duur;

      const stap = (nu: number) => {
        const p = clamp((nu - t0) / duur, 0, 1);
        window.scrollTo(0, startY + (eindY - startY) * easeInOutCubic(p));
        if (p < 1) {
          tweenRAF = requestAnimationFrame(stap);
        } else {
          tweent = false;
          tweenEinde = performance.now();
        }
      };
      tweenRAF = requestAnimationFrame(stap);
    };

    const verschuif = (richting: number) => tweenNaar(doelStop + richting);

    /**
     * Mag een nieuw gebaar de lopende tween overnemen? Alleen binnen een snelle
     * sectie, en pas als die tween al een eind op weg is — anders schiet elke
     * trilling van het trackpad je meteen drie lagen verder.
     */
    const magOnderbreken = () =>
      tweent && tweenSnel && performance.now() - tweenT0 > tweenDuur * ONDERBREEK_VANAF;

    const spring = (index: number) => {
      const doel = clamp(index, 0, stops - 1);
      cancelAnimationFrame(tweenRAF);
      doelStop = doel;
      const eindY = top() + doel * vh();
      window.scrollTo(0, eindY);
      rawScroll = doel * vh();
      vizScroll = doel;
      verdeel(vizScroll);
      laatsteViz = vizScroll;
      tweent = false;
      tweenSnel = false;
      settle = SETTLE;
      tweenEinde = performance.now();
    };
    springExtern = spring;

    /* ── Scroll bijhouden; snap terug als er op een andere manier is bewogen ── */
    const opScroll = () => {
      rawScroll = window.scrollY - top();
      if (tweent) return;
      // Boven de stage niet snappen: dan zou de hero je meteen terugtrekken.
      if (!inStage()) return;
      window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(() => {
        if (tweent) return;
        const dichtst = clamp(Math.round(rawScroll / vh()), 0, stops - 1);
        doelStop = dichtst;
        if (Math.abs(rawScroll - dichtst * vh()) > 2) tweenNaar(dichtst);
      }, 150);
    };

    /* ── Wheel: pagineren per gesture, trackpad-momentum opslokken ── */
    let vorigeTijd = 0;
    let vorigeDelta = 0;
    const opWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // pinch-zoom met rust laten
      if (!inStage()) return; // hero erboven scrollt gewoon
      // Op stop 0 omhoog: de wheel teruggeven zodat je de hero weer in kunt.
      if (e.deltaY < 0 && doelStop === 0 && window.scrollY <= top() + 4) return;

      // Interne scrollers houden de wheel zolang ze zelf nog verder kunnen.
      const doel = e.target as HTMLElement | null;
      const scroller = doel?.closest?.("[data-stage-scroller]") as HTMLElement | null;
      if (scroller) {
        const kanScrollen = scroller.scrollHeight > scroller.clientHeight + 4;
        const bovenaan = scroller.scrollTop <= 0;
        const onderaan =
          scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
        if (kanScrollen && ((e.deltaY > 0 && !onderaan) || (e.deltaY < 0 && !bovenaan))) {
          return;
        }
      }

      e.preventDefault();
      const nu = performance.now();
      const d = Math.abs(e.deltaY);
      // "Vers" = pauze sinds het vorige event, of de delta groeit weer duidelijk.
      const vers = nu - vorigeTijd > 150 || d > vorigeDelta * 1.4;
      vorigeTijd = nu;
      vorigeDelta = d;

      if (d < 12) return;
      // Binnen een sectie mag een vers gebaar de lopende tween overnemen; bij een
      // sectiewissel niet, die moet zijn volle 950ms krijgen.
      if (tweent && !magOnderbreken()) return;
      if (!tweent && nu - tweenEinde < settle) return; // settle-window
      if (!vers && d < 80) return; // uitdovende momentum-staart

      verschuif(e.deltaY > 0 ? 1 : -1);
    };

    /* ── Touch: native scroll blokkeren, één swipe = één stop ── */
    let startY = 0;
    const opTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
    };
    const opTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) return; // pinch toestaan
      if (!inStage()) return;
      const doel = e.target as HTMLElement | null;
      const paneel = doel?.closest?.("[data-stage-scroller]") as HTMLElement | null;
      if (paneel && paneel.scrollHeight > paneel.clientHeight + 4) return;
      // Op stop 0 omlaag vegen = terug naar de hero; die swipe niet opeten.
      if (doelStop === 0 && window.scrollY <= top() + 4 && e.touches[0].clientY > startY) {
        return;
      }
      e.preventDefault();
    };
    const opTouchEnd = (e: TouchEvent) => {
      if (!inStage()) return;
      const doel = e.target as HTMLElement | null;
      const paneel = doel?.closest?.("[data-stage-scroller]") as HTMLElement | null;
      if (paneel && paneel.scrollHeight > paneel.clientHeight + 4) return;
      if (tweent && !magOnderbreken()) return;
      const dy = startY - e.changedTouches[0].clientY;
      if (dy < 0 && doelStop === 0 && window.scrollY <= top() + 4) return;
      if (Math.abs(dy) > 40) verschuif(dy > 0 ? 1 : -1);
    };

    const opToets = (e: KeyboardEvent) => {
      if (!inStage()) return;
      if (e.key === "ArrowUp" || e.key === "PageUp") {
        if (doelStop === 0 && window.scrollY <= top() + 4) return;
      }
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        if (!tweent || magOnderbreken()) verschuif(1);
      }
      if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        if (!tweent || magOnderbreken()) verschuif(-1);
      }
    };

    // Verbergt de tab zich midden in een tween, dan stopt RAF: direct afronden,
    // anders blijft `tweent` hangen en zit de scroll permanent op slot.
    const opZichtbaarheid = () => {
      if (document.hidden && tweent) {
        cancelAnimationFrame(tweenRAF);
        window.scrollTo(0, top() + doelStop * vh());
        tweent = false;
        tweenEinde = performance.now();
      }
    };

    const opResize = () => {
      if (window.innerHeight < 1) return;
      zetHoogte();
      spring(doelStop);
    };

    window.addEventListener("scroll", opScroll, { passive: true });
    window.addEventListener("wheel", opWheel, { passive: false });
    window.addEventListener("touchstart", opTouchStart, { passive: true });
    window.addEventListener("touchmove", opTouchMove, { passive: false });
    window.addEventListener("touchend", opTouchEnd, { passive: true });
    window.addEventListener("keydown", opToets);
    window.addEventListener("resize", opResize, { passive: true });
    document.addEventListener("visibilitychange", opZichtbaarheid);

    return () => {
      cancelAnimationFrame(lusRAF);
      cancelAnimationFrame(tweenRAF);
      window.clearTimeout(snapTimer);
      window.removeEventListener("scroll", opScroll);
      window.removeEventListener("wheel", opWheel);
      window.removeEventListener("touchstart", opTouchStart);
      window.removeEventListener("touchmove", opTouchMove);
      window.removeEventListener("touchend", opTouchEnd);
      window.removeEventListener("keydown", opToets);
      window.removeEventListener("resize", opResize);
      document.removeEventListener("visibilitychange", opZichtbaarheid);
      springExtern = null;
    };
  }, [stops, snelVan, snelTot]);

  if (statisch) {
    return (
      <StageContext.Provider value={{ abonneer, stops, statisch: true }}>
        {children}
      </StageContext.Provider>
    );
  }

  return (
    <StageContext.Provider value={{ abonneer, stops, statisch: false }}>
      {/*
        Inline styles en geen utility-klassen: dit pakket mag niet afhangen van
        een Tailwind-configuratie die het zelf niet kan zien.
      */}
      <div
        ref={stageRef}
        style={{ position: "relative", height: `calc(${stops} * 100svh)` }}
      >
        {/*
          `sticky` en geen `fixed`: met een hero bóven de stage zou een fixed pin
          ook over die hero heen liggen. Sticky plakt alleen zolang de stage zelf
          in beeld is.
        */}
        <div
          style={{
            position: "sticky",
            top: 0,
            height: "100svh",
            overflow: "hidden",
          }}
        >
          {children}
        </div>
      </div>
    </StageContext.Provider>
  );
}
