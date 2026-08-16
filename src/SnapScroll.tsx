"use client";

import { useEffect } from "react";
import { DUUR_SECTIE, clamp, easeInOutCubic } from "./easing";

/**
 * Transitie 101 — één gesture = één sectie, easeInOutCubic-tween,
 * trackpad-momentum wordt ingeslikt. Na de laatste snap-sectie loopt
 * de pagina over in vrije scroll.
 *
 * Op touch-apparaten en bij prefers-reduced-motion doet dit component
 * niets: daar regelt CSS scroll-snap de uitlijning. Zet daarvoor
 * `scroll-snap-type` op de container in je eigen stylesheet.
 */
export default function SnapScroll({
  sections,
  duur = DUUR_SECTIE,
}: {
  /** Aantal secties dat op volle viewporthoogte snapt, vanaf de bovenkant. */
  sections: number;
  /** Duur van één sprong in ms. Alleen aanpassen met een reden. */
  duur?: number;
}) {
  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const vh = () => window.innerHeight;
    const zoneEnd = () => (sections - 1) * vh();

    let tweening = false;
    let tweenRAF = 0;
    let lastTweenEnd = 0;
    let snapTimer: number | undefined;
    let watchdog: number | undefined;
    let lastWheelT = 0;
    let lastWheelD = 0;
    let tweenEndY = 0;

    function finishTween() {
      cancelAnimationFrame(tweenRAF);
      window.scrollTo({ top: tweenEndY, behavior: "instant" });
      tweening = false;
      lastTweenEnd = performance.now();
    }

    function tweenTo(index: number) {
      index = clamp(index, 0, sections - 1);
      cancelAnimationFrame(tweenRAF);
      const startY = window.scrollY;
      const endY = index * vh();
      tweenEndY = endY;
      if (Math.abs(endY - startY) < 2) {
        tweening = false;
        lastTweenEnd = performance.now();
        return;
      }
      tweening = true;
      const t0 = performance.now();
      tweenRAF = requestAnimationFrame(function step(now: number) {
        const p = clamp((now - t0) / duur, 0, 1);
        window.scrollTo({
          top: startY + (endY - startY) * easeInOutCubic(p),
          behavior: "instant",
        });
        if (p < 1) tweenRAF = requestAnimationFrame(step);
        else {
          tweening = false;
          lastTweenEnd = performance.now();
        }
      });
      // Vangnet: als RAF stilvalt (gethrottelde tab), toch netjes landen
      window.clearTimeout(watchdog);
      watchdog = window.setTimeout(() => {
        if (tweening) finishTween();
      }, duur + 250);
    }

    // Uitgelijnd → één sectie verder; niet uitgelijnd (bv. teruggescrold
    // vanuit de vrije zone) → eerst uitlijnen in de scrollrichting
    function gesture(dir: 1 | -1) {
      if (vh() < 1) return; // viewport (nog) niet gemeten — nooit met 0 rekenen
      const idx = window.scrollY / vh();
      const nearest = Math.round(idx);
      if (Math.abs(idx - nearest) > 0.08) {
        tweenTo(dir > 0 ? Math.ceil(idx) : Math.floor(idx));
      } else {
        tweenTo(nearest + dir);
      }
    }

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // pinch-zoom
      const y = window.scrollY;
      if (y > zoneEnd() + 2) return; // vrije zone → native scroll
      if (y >= zoneEnd() - 2 && e.deltaY > 0 && !tweening) return; // zone uit, omlaag
      e.preventDefault();
      const now = performance.now();
      const d = Math.abs(e.deltaY);
      // "Vers" gebaar = pauze sinds vorig event, of delta die weer duidelijk groeit
      const fresh = now - lastWheelT > 150 || d > lastWheelD * 1.4;
      lastWheelT = now;
      lastWheelD = d;
      if (tweening || d < 12) return;
      if (now - lastTweenEnd < 350) return; // settle-venster
      if (!fresh && d < 80) return; // uitstervend momentum
      gesture(e.deltaY > 0 ? 1 : -1);
    };

    const onKey = (e: KeyboardEvent) => {
      const down = e.key === "ArrowDown" || e.key === "PageDown";
      const up = e.key === "ArrowUp" || e.key === "PageUp";
      if (!down && !up) return;
      if (
        e.target instanceof HTMLElement &&
        e.target.closest("input, textarea, select")
      )
        return;
      const y = window.scrollY;
      if (y > zoneEnd() + 2) return;
      if (down && y >= zoneEnd() - 2) return;
      e.preventDefault();
      if (!tweening) gesture(down ? 1 : -1);
    };

    // Uitlijning herstellen na scrollen via andere wegen (scrollbar, ankers)
    const onScroll = () => {
      if (tweening) return;
      window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(() => {
        if (tweening || vh() < 1) return;
        const y = window.scrollY;
        if (y > zoneEnd() + 2) return;
        const nearest = clamp(Math.round(y / vh()), 0, sections - 1);
        if (Math.abs(y - nearest * vh()) > 2) tweenTo(nearest);
      }, 160);
    };

    // Tab verborgen mid-tween: RAF stopt — meteen afronden, nooit vastlopen
    const onVis = () => {
      if (document.hidden && tweening) finishTween();
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVis);
      cancelAnimationFrame(tweenRAF);
      window.clearTimeout(snapTimer);
      window.clearTimeout(watchdog);
    };
  }, [sections, duur]);

  return null;
}
