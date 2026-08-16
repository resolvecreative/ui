/*
  Eén bron voor de timing van Transitie 101. Wie hier iets verandert,
  verandert het ritme van elke site die dit package gebruikt.
*/

/** Bewust vertrek, zachte landing. */
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Zachte 0→1 tussen `a` en `b`; buiten dat bereik vlak. */
export function venster(v: number, a: number, b: number) {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export const clamp = (v: number, a: number, b: number) =>
  Math.min(b, Math.max(a, v));

/** Nederlandse naam voor clamp, zoals in de oudere sites. */
export const klem = clamp;

/* ── SnapScroll: hele secties, één duur ── */

/** Duur van één sectie-sprong. Basis 950ms, desktop ~15% ruimer. */
export const DUUR_SECTIE = 1090;

/** Duur van een anker-scroll; korter, want de afstand is meestal kleiner. */
export const DUUR_ANKER = 900;

/* ── Stage: stops met twee tempo's ──
   Bewust andere waarden dan DUUR_SECTIE: de Stage draagt een pin met
   gestapelde panelen, waar een sprong zwaarder mag aanvoelen dan een
   stap bínnen dezelfde sectie. Niet gelijktrekken zonder te kijken. */

export const DUUR_STOP_DESKTOP = 950;
export const DUUR_STOP_MOBIEL = 1100;

/**
 * Stappen bínnen één sectie gaan op een eigen, korter tempo. Een sectiewissel
 * mag zwaar aanvoelen, vijf niveaus doorlopen niet — met 950ms plus settle
 * kost dat ruim zes seconden.
 */
export const DUUR_SNEL_DESKTOP = 460;
export const DUUR_SNEL_MOBIEL = 560;

/** Hoe lang na een tween een nieuw wiel-gebaar wordt genegeerd. */
export const SETTLE = 350;
export const SETTLE_SNEL = 110;

/** Vanaf welk deel van een snelle tween een volgend gebaar mag doorpakken. */
export const ONDERBREEK_VANAF = 0.4;

export const MOBIEL_BREEDTE = 768;
