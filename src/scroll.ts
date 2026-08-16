/*
  Zachte scroll naar een positie of element. Bewust een eigen tween in plaats
  van `scroll-behavior: smooth`: die is per browser anders lang en heeft geen
  easing die bij de rest van de site past.
*/

import { DUUR_ANKER, easeInOutCubic } from "./easing";

let lopend = 0;

/** Scrollt naar een absolute y-positie. */
export function scrollNaar(doel: number, duur: number = DUUR_ANKER) {
  if (lopend) cancelAnimationFrame(lopend);

  const start = window.scrollY;
  const afstand = doel - start;
  if (Math.abs(afstand) < 2) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo(0, doel);
    return;
  }

  const begin = performance.now();
  const stap = (nu: number) => {
    const p = Math.min((nu - begin) / duur, 1);
    window.scrollTo(0, start + afstand * easeInOutCubic(p));
    lopend = p < 1 ? requestAnimationFrame(stap) : 0;
  };
  lopend = requestAnimationFrame(stap);
}

/**
 * Scrollt naar een element, met de hoogte van de vaste header eraf gerekend.
 * Zonder `header` in de pagina wordt er geen marge afgetrokken.
 */
export function scrollNaarElement(el: Element, duur: number = DUUR_ANKER) {
  const header = document.querySelector("header");
  const marge = header ? header.getBoundingClientRect().height : 0;
  scrollNaar(el.getBoundingClientRect().top + window.scrollY - marge, duur);
}
