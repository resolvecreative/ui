/*
  Eén bron voor de timing van Transitie 101. Wie hier iets verandert,
  verandert het ritme van elke site die dit package gebruikt.
*/

/** Bewust vertrek, zachte landing. */
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Duur van één sectie-sprong. Basis 950ms, desktop ~15% ruimer. */
export const DUUR_SECTIE = 1090;

/** Duur van een anker-scroll; korter, want de afstand is meestal kleiner. */
export const DUUR_ANKER = 900;

export const clamp = (v: number, a: number, b: number) =>
  Math.min(b, Math.max(a, v));
