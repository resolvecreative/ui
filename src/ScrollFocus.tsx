"use client";

import { useEffect } from "react";

/* Scrollfocus — blokken komen op als ze onderin het scherm binnenkomen en
   gaan weer weg als ze er bovenin uit gaan, de hele pagina door en in beide
   richtingen. Een blok doet mee met data-scrollfocus; de maten staan als
   variabelen in styles.css onder "Scrollfocus"; een site overschrijft ze op :root.

   Plus de plafondregel: een wrapper met data-scrollfocus-plafond is 0 bij
   scroll 0 en komt op over de eerste --sf-plafond-zone scroll.

   Plus de staartregel (zie meet): blokken onderaan de pagina krijgen een
   kortere in-zone, anders komen ze nooit vol in beeld. Die draait altijd.

   Browsers met animation-timeline: view() doen het scrollwerk zelf in CSS,
   buiten de JS-thread — behalve iOS, zie hieronder bij "native". Voor de
   rest is dit ook de terugval (o.a. iPhones vóór iOS 26):
   één scroll-luisteraar met rAF die alleen blokken in beeld bijwerkt. Hij
   rekent niets uit over opmaak: hij zet per blok twee getallen tussen 0 en 1
   (--sf-in en --sf-uit) en de CSS maakt daar dekking en verschuiving van.

   Posities komen uit de offsetTop-keten en niet uit getBoundingClientRect:
   die telt de verschuiving mee die we zelf zetten, en dan duwt het blok
   zijn eigen meting weg. */

type Blok = {
  el: HTMLElement;
  boven: number;
  hoogte: number;
  /* waar de in-zone begint en eindigt, gemeten van de onderrand omhoog */
  van: number;
  tot: number;
  staart: boolean;
  in_: string;
  uit: string;
};

function documentTop(el: HTMLElement) {
  let y = 0;
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) {
    y += n.offsetTop;
  }
  return y;
}

/* Meet een CSS-lengte (bv. 18vh) door hem als hoogte op een leeg blok te zetten */
function meetLengte(variabele: string) {
  const proef = document.createElement("div");
  proef.style.cssText = `position:absolute;visibility:hidden;height:var(${variabele})`;
  document.body.appendChild(proef);
  const px = proef.offsetHeight;
  proef.remove();
  return px;
}

/* Zelfde curve als --sf-curve in styles.css: cubic-bezier(0.37, 0, 0.63, 1) (sinus in-uit).
   Zoekt bij voortgang x de bijbehorende y met een paar Newton-stappen. */
const CURVE = [0.37, 0, 0.63, 1] as const;

function bezier(x: number) {
  const [x1, y1, x2, y2] = CURVE;
  const bx = (t: number) => 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3;
  const by = (t: number) => 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3;
  let t = x;
  for (let i = 0; i < 6; i++) {
    const d =
      3 * (1 - t) ** 2 * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t ** 2 * (1 - x2);
    if (Math.abs(d) < 1e-6) break;
    t = Math.min(Math.max(t - (bx(t) - x) / d, 0), 1);
  }
  return by(t);
}

/** Hoeveel pixels vóór de bodem een staartblok al vol staat */
const STAART_MARGE = 12;

/* iPhone, iPod en iPad. iPadOS doet zich voor als Mac, maar een Mac heeft
   geen touchscreen. Elke browser op iOS is WebKit, dus dit geldt ook voor
   Chrome en Firefox daar. */
function isIOS() {
  const ua = navigator.userAgent;
  return /iP(hone|od|ad)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function klem(t: number) {
  return Math.min(Math.max(t, 0), 1);
}

export default function ScrollFocus() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    /* Met animation-timeline doet CSS het scrollwerk; dan draait hier alleen
       de staartregel (bij laden en resize), geen scroll-luisteraar.
       Behalve op iOS: daar rekent Safari de animatie wel uit (computed
       opacity klopt) maar tekent hij hem niet altijd — gemeten op iOS 26,
       24 sep 2026: blokken bleven vol wit staan. Geen laag-truc hielp
       (will-change op blok, ouder of sectie); stijl via de motor wel. */
    const native = CSS.supports("animation-timeline: view()") && !isIOS();

    const html = document.documentElement;
    if (!native) html.classList.add("sf-js");

    const blokken: Blok[] = Array.from(
      document.querySelectorAll<HTMLElement>("[data-scrollfocus]"),
      (el) => ({ el, boven: 0, hoogte: 0, van: 0, tot: 1, staart: false, in_: "", uit: "" }),
    );
    const inBeeld = new Set<Blok>();
    const plafonds = Array.from(
      document.querySelectorAll<HTMLElement>("[data-scrollfocus-plafond]"),
    );
    let zonePlafond = 1;
    let plafondWaarde = "";
    let zoneUit = 1;
    let gepland = false;

    const zet = (b: Blok) => {
      const vh = window.innerHeight;
      const top = b.boven - window.scrollY;
      /* De uit-animatie loopt in CSS van 1 naar 0 met de curve over zijn
         eigen voortgang; vandaar hier 1 - curve(1 - x) en niet curve(x). */
      const in_ = bezier(klem((vh - top - b.van) / (b.tot - b.van))).toFixed(3);
      const uit = (1 - bezier(1 - klem((top + b.hoogte) / zoneUit))).toFixed(3);
      if (in_ !== b.in_) b.el.style.setProperty("--sf-in", (b.in_ = in_));
      if (uit !== b.uit) b.el.style.setProperty("--sf-uit", (b.uit = uit));
    };

    /* Plafondregel: dekking volgt de scrollpositie, niet de plek op het scherm */
    const zetPlafond = () => {
      const w = bezier(klem(window.scrollY / zonePlafond)).toFixed(3);
      if (w === plafondWaarde) return;
      plafondWaarde = w;
      for (const el of plafonds) el.style.setProperty("--sf-plafond", w);
    };

    /* Staartregel: een blok onderaan de pagina komt nooit ver genoeg omhoog
       om de hele in-zone af te lopen, want het scrollen houdt eerder op. Voor
       zo'n blok krimpen dode strook en zone naar verhouding, zodat hij
       precies vol staat als je de bodem raakt. "van" en "tot" zijn afstanden
       van de bovenkant van het blok tot de onderrand van het scherm. */
    const meet = () => {
      const vh = window.innerHeight;
      const maxScroll = Math.max(html.scrollHeight - vh, 0);
      const startIn = meetLengte("--sf-in-start");
      const eindIn = startIn + Math.max(meetLengte("--sf-in-zone"), 1);
      zonePlafond = Math.max(meetLengte("--sf-plafond-zone"), 1);
      zoneUit = Math.max(meetLengte("--sf-uit-zone"), 1);

      for (const b of blokken) {
        b.boven = documentTop(b.el);
        b.hoogte = b.el.offsetHeight;
        /* 12px marge: vol net vóór de bodem, zodat afronding of een
           iets kortere pagina hem niet op 97% laat hangen */
        const haalbaar = vh - (b.boven - maxScroll) - STAART_MARGE;
        const staart = haalbaar < eindIn;
        if (staart) {
          const deel = Math.max(haalbaar, 1) / eindIn;
          b.van = startIn * deel;
          b.tot = Math.max(haalbaar, 1);
          b.el.style.setProperty("--sf-van", `${b.van.toFixed(1)}px`);
          b.el.style.setProperty("--sf-tot", `${b.tot.toFixed(1)}px`);
        } else {
          b.van = startIn;
          b.tot = eindIn;
          if (b.staart) {
            b.el.style.removeProperty("--sf-van");
            b.el.style.removeProperty("--sf-tot");
          }
        }
        b.staart = staart;
        if (!native) zet(b);
      }
      if (!native) zetPlafond();
    };

    // Hoogtes veranderen door fonts, het formulier, een draaiend scherm;
    // de schermhoogte door de adresbalk
    const ro = new ResizeObserver(meet);
    ro.observe(document.body);
    window.addEventListener("resize", meet);
    meet();

    const frame = () => {
      gepland = false;
      inBeeld.forEach(zet);
      zetPlafond();
    };

    const opScroll = () => {
      if (gepland) return;
      gepland = true;
      requestAnimationFrame(frame);
    };

    let io: IntersectionObserver | null = null;
    if (!native) {
      const perEl = new Map(blokken.map((b) => [b.el, b]));
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            const b = perEl.get(e.target as HTMLElement);
            if (!b) continue;
            if (e.isIntersecting) inBeeld.add(b);
            else inBeeld.delete(b);
            /* Meteen bijwerken: de melding komt ná het scrollframe, dus een
               blok dat net binnenkomt (of net weg is) zou anders tot de
               volgende scroll in zijn oude stand blijven hangen. */
            zet(b);
          }
        },
        { rootMargin: "10% 0px" },
      );
      blokken.forEach((b) => io!.observe(b.el));
      window.addEventListener("scroll", opScroll, { passive: true });
    }

    return () => {
      window.removeEventListener("scroll", opScroll);
      window.removeEventListener("resize", meet);
      io?.disconnect();
      ro.disconnect();
      html.classList.remove("sf-js");
      for (const b of blokken) {
        for (const v of ["--sf-in", "--sf-uit", "--sf-van", "--sf-tot"]) b.el.style.removeProperty(v);
      }
      for (const el of plafonds) el.style.removeProperty("--sf-plafond");
    };
  }, []);

  return null;
}
