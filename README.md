# @brickbybrick-nl/ui

Gedeelde beweging voor BrickByBrick-websites: Transitie 101, scroll-reveal, de
page-load intro en de timing die daar onder ligt. Eén bron, zodat een wijziging
in het ritme niet in elke site apart hoeft.

Wat hier **niet** in hoort: merkonderdelen van BrickByBrick zelf (BrickMark,
MorphLogo) en alles wat aan één site vastzit (navigatie, prijskaarten, hero's).
Dit pakket is de beweging, niet de huisstijl.

## Installeren

Vastzetten op een tag, nooit op een branch — anders verandert een site zonder
dat je hem hebt aangeraakt.

```bash
pnpm add "@brickbybrick-nl/ui@github:brickbybrick-nl/ui#v1.0.0"
```

Het pakket wordt als TypeScript geleverd, dus Next moet hem meenemen in de
transpilatie. In `next.config.ts`:

```ts
const nextConfig = {
  transpilePackages: ["@brickbybrick-nl/ui"],
};
```

En één keer de stylesheet in je root layout:

```ts
import "@brickbybrick-nl/ui/styles.css";
```

## Gebruik

### SnapScroll — Transitie 101

Eén scrollgebaar is één sectie. Trackpad-momentum wordt ingeslikt, zodat één
veeg niet drie secties doorschiet. Geef het aantal secties dat op volle
viewporthoogte snapt; daarna loopt de pagina over in vrije scroll.

```tsx
import { SnapScroll } from "@brickbybrick-nl/ui";

<SnapScroll sections={5} />;
```

Op touch en bij `prefers-reduced-motion` doet het component niets. Regel de
uitlijning daar met CSS `scroll-snap-type` in je eigen stylesheet.

### Reveal

```tsx
import { Reveal } from "@brickbybrick-nl/ui";

<Reveal delay={120}>
  <h2>Komt binnen zodra hij in beeld staat</h2>
</Reveal>;
```

### IntroReveal

Preloader met watermerk, dan een boog die opengaat. De sectie eronder leest de
fase en start zijn eigen entrance op het juiste moment.

```tsx
import { IntroReveal, useIntroPhase } from "@brickbybrick-nl/ui";

<IntroReveal brand="Eiland de Wild">
  <Hero />
</IntroReveal>;

// in Hero:
const phase = useIntroPhase(); // "load" | "opening" | "done"
```

### Anker-scroll

```ts
import { scrollNaar, scrollNaarElement } from "@brickbybrick-nl/ui";

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
