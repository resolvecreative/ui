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
pnpm add "@resolvecreative/ui@github:resolvecreative/ui#v1.2.2"
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

### ScrollFocus — standaard op elke site

Blokken komen continu op als ze onderin het scherm binnenkomen en gaan weer weg
als ze er bovenin uit gaan, in beide richtingen. Telefoon én desktop. Het
scrollwerk doet CSS zelf (`animation-timeline: view()`); browsers zonder
ondersteuning krijgen een JS-motor met dezelfde waarden. **iOS krijgt altijd de
JS-motor**: Safari op iPhone/iPad rekent de CSS-animatie wel uit maar tekent hem
niet altijd (blokken staan dan vol wit). De motor dempt: waarden glijden in
~0,5 s naar de scrollstand (`DEMPING_MS` = 140), zodat een te laat frame geen
schokje geeft. In rust staat de lus stil. Test een site daarom altijd óók op een
echte iPhone — Playwright-WebKit op de Mac laat dit niet zien.

Zet `<ScrollFocus />` op **elke pagina** (niet in de layout: bij client-navigatie
moet hij opnieuw meten) en markeer de blokken:

```tsx
import { ScrollFocus } from "@resolvecreative/ui";

<section>
  <p data-scrollfocus>Label</p>
  <div data-scrollfocus>Kaart</div>
</section>
<ScrollFocus />;
```

Per blok, niet per sectie: kop, tekst en kaarten elk apart.

- **Plafondregel** — de eerste sectie na de hero krijgt binnen zich een wrapper
  met `data-scrollfocus-plafond`. Bij scroll 0 is die 0, zodat er op een iPhone
  niets onder de hero doorschemert achter de doorzichtige Safari-balk.
- **Staartregel** — gaat vanzelf: blokken onderaan de pagina krijgen een kortere
  zone en staan vol net vóór de bodem.

Toepassingsregels:

- niet op een element dat zelf opacity, translate of een animatie heeft — zet het
  op een wrapper eromheen;
- geen `overflow: hidden/auto/scroll` op een voorouder: dan loopt het blok met
  díe scrollcontainer mee. Knip met `overflow: clip`;
- niet op de hero en niet op de footer;
- in een gepinde sectie alleen opkomen, niet weggaan (anders vervaagt hij tijdens
  het pinnen). Een sectie komt eerst gewoon van onderen binnen en pint pas als hij
  bovenaan staat:

```css
@media (min-width: 1024px) {
  .mijn-pin [data-scrollfocus] {
    animation-name: sf-in, none !important;
  }
  .sf-js .mijn-pin [data-scrollfocus] {
    opacity: var(--sf-in, 1) !important;
    translate: 0 calc((1 - var(--sf-in, 1)) * var(--sf-in-afstand)) !important;
  }
}
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
| `--sf-in-start` | dode strook onderin, blok nog onzichtbaar | `12vh` |
| `--sf-in-zone` | hoogte waarover een blok opkomt | `40vh` |
| `--sf-uit-zone` | hoogte bovenin waarover hij weggaat | `25vh` |
| `--sf-in-afstand` / `--sf-uit-afstand` | verschuiving bij opkomen / weggaan | `32px` / `16px` |
| `--sf-plafond-zone` | scroll waarover de plafond-wrapper opkomt | `15vh` |
| `--sf-curve` | verloop (houd gelijk aan `CURVE` in ScrollFocus.tsx) | sinus in-uit |

De timing van Transitie 101 (`DUUR_SECTIE`, 1090ms) staat in `src/easing.ts` en
geldt voor alle sites tegelijk. Wijk daar per site alleen met een reden van af,
via de `duur`-prop.

## Versies

Elke wijziging die bestaande sites raakt, krijgt een nieuwe tag. Sites volgen
pas als je hun `package.json` bijwerkt — een site verandert nooit vanzelf.

```bash
git tag v1.1.0 && git push origin v1.1.0
```
