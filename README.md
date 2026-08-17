# @resolvecreative/ui

Gedeelde beweging voor Resolve Creative-websites: Transitie 101, scroll-reveal, de
page-load intro en de timing die daar onder ligt. Eén bron, zodat een wijziging
in het ritme niet in elke site apart hoeft.

Wat hier **niet** in hoort: merkonderdelen van Resolve Creative zelf (BrickMark,
MorphLogo) en alles wat aan één site vastzit (navigatie, prijskaarten, hero's).
Dit pakket is de beweging, niet de huisstijl.

## Installeren

Vastzetten op een tag, nooit op een branch — anders verandert een site zonder
dat je hem hebt aangeraakt.

```bash
pnpm add "@resolvecreative/ui@github:resolvecreative/ui#v1.1.2"
```

Het pakket wordt als TypeScript geleverd, dus Next moet hem meenemen in de
transpilatie. In `next.config.ts`:

```ts
const nextConfig = {
  transpilePackages: ["@resolvecreative/ui"],
};
```

En één keer de stylesheet in je root layout:

```ts
import "@resolvecreative/ui/styles.css";
```

## Gebruik

### SnapScroll — Transitie 101

Eén scrollgebaar is één sectie. Trackpad-momentum wordt ingeslikt, zodat één
veeg niet drie secties doorschiet. Geef het aantal secties dat op volle
viewporthoogte snapt; daarna loopt de pagina over in vrije scroll.

```tsx
import { SnapScroll } from "@resolvecreative/ui";

<SnapScroll sections={5} />;
```

Op touch en bij `prefers-reduced-motion` doet het component niets. Regel de
uitlijning daar met CSS `scroll-snap-type` in je eigen stylesheet.

### Stage — Transitie 101, zware variant

Voor pagina's waar de panelen op elkaar gepind liggen in plaats van onder elkaar
te staan. Eén tall stage van `stops` × 100vh met een sticky pin; de panelen
schrijven per frame hun eigen opacity en transform.

```tsx
import { Stage, useStageFrame, venster } from "@resolvecreative/ui";

<Stage stops={7} snelleStops={[1, 5]}>
  <Hero />
  <OpbouwPaneel />
</Stage>;

// in een paneel — schrijf rechtstreeks naar de DOM, geen React-state:
useStageFrame((viz) => {
  el.style.opacity = String(venster(viz, 0.3, 0.85));
});
```

`snelleStops` is het inclusieve bereik waarbinnen een stap als "binnen dezelfde
sectie" telt: kortere tween (460ms tegen 950ms), kortere settle, en een vers
gebaar mag een lopende tween vanaf 40% overnemen. Bedoeld voor reeksen die je
achter elkaar doorloopt zonder dat het zwaar aanvoelt.

Verder beschikbaar: `useStageStatisch()` (true bij `prefers-reduced-motion`),
`stageSpringNaar(stop)` voor navigatie buiten de stage om — hash-ankers werken
niet onder een gehijackte scroll — en `zetStageSlot(true)` om de hijack helemaal
uit te zetten zolang er een dialoog overheen ligt. Een element met
`data-stage-scroller` houdt de wheel zolang het zelf nog kan scrollen.

**SnapScroll of Stage?** SnapScroll snapt hele secties in de gewone
documentstroom en laat de pagina daarna vrij lopen. Stage pint panelen op elkaar
en kent twee tempo's. Staan je secties gewoon onder elkaar, neem dan SnapScroll.

### Reveal

```tsx
import { Reveal } from "@resolvecreative/ui";

<Reveal delay={120}>
  <h2>Komt binnen zodra hij in beeld staat</h2>
</Reveal>;
```

### IntroReveal

Preloader met watermerk, dan een boog die opengaat. De sectie eronder leest de
fase en start zijn eigen entrance op het juiste moment.

```tsx
import { IntroReveal, useIntroPhase } from "@resolvecreative/ui";

<IntroReveal brand="Eiland de Wild">
  <Hero />
</IntroReveal>;

// in Hero:
const phase = useIntroPhase(); // "load" | "opening" | "done"
```

### Anker-scroll

```ts
import { scrollNaar, scrollNaarElement } from "@resolvecreative/ui";

scrollNaarElement(document.querySelector("#contact")!);
```

Rekent de hoogte van een vaste `header` er automatisch af.

## Aanpassen aan een site

De stylesheet leest variabelen met een fallback. Zet op `:root` alleen wat
afwijkt:

| Variabele | Waarvoor | Valt terug op |
|---|---|---|
| `--bbb-reveal-afstand` | hoe ver een element inschuift | `30px` |
| `--bbb-reveal-duur` | duur van de reveal | `0.9s` |
| `--bbb-intro-bg` | achtergrond van de preloader | `--bg`, dan wit |
| `--bbb-intro-fg` | kleur van het watermerk | `--hero-fg`, dan `currentColor` |
| `--bbb-intro-lijn` | randje om de preloader | `--line`, dan zwart 12% |
| `--bbb-intro-font` | font van het watermerk | het font van de pagina |

De timing van Transitie 101 (`DUUR_SECTIE`, 1090ms) staat in `src/easing.ts` en
geldt voor alle sites tegelijk. Wijk daar per site alleen met een reden van af,
via de `duur`-prop.

## Versies

Elke wijziging die bestaande sites raakt, krijgt een nieuwe tag. Sites volgen
pas als je hun `package.json` bijwerkt — een site verandert nooit vanzelf.

```bash
git tag v1.1.0 && git push origin v1.1.0
```
