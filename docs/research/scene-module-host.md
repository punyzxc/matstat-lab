# Scene module host

Research for `scene-module-host` (#37). Owner: punyzxc (captain). Date: 2026-11-24.

**Question.** Can the Orbital laboratory host every module inside its one scene (no page scroll, no extra views) with keyboard and URL-hash state?

**Answer.** Yes. The spike in `spikes/visual-foundation` now runs as one screen. Four lecture orbits share the six slots around the globe. Every station, the lab notes and the sample record open as panels inside the scene. The URL hash holds the whole state.

## What changed in the spike

| Before | After |
| --- | --- |
| The home page scrolled to "Sample record" and a "Trefoil" section below the scene. | The document never scrolls (`html, body { overflow: hidden }`, a `100dvh` grid). The record and the trefoil study are a scene drawer (`#record`). |
| The header had "Observatory", "Experiments" (a scroll anchor) and "Lab notes" (a modal dialog). | The header holds the four lecture orbits (I Probability, II Random variables, III Limit theorems, IV Statistics) and two tools: Sample record and Lab notes. Both open as drawers inside the scene. |
| Each instrument was a separate full page with its own header, footer and back link. | Each station opens in a dock over the dimmed globe (`SceneDock`). The scene, header and orbit switcher stay visible, and only the dock scrolls. |
| Six fixed instrument cards. | `src/stations/catalog.ts` lists 18 stations by orbit (lecture map, PR #48). The six prototype instruments keep their cards. New stations get a lecture card that shows the issue of their kernel until it lands. |
| Hash routes `#module/<id>`, `#workspace`. | `#orbit/<id>`, `#station/<id>?seed=…&<param>=…`, `#notes`, `#record`. The old routes still resolve. |

## Kernel contract wiring

`src/stations/kernel-station.tsx` loads every `spikes/*/kernel.mjs` lazily with `import.meta.glob`. A station of kind `kernel` renders its parameters as sliders, adds a seed field and shows `series` in a small SVG plot and `readouts` in a table. Submitting the form writes the parameters and the seed to the URL hash, so the hash is the single source of truth. Parameters are clamped to their declared range and step (`resolveParams`). A missing kernel shows a pending panel with a link to its issue. `vite.config.mjs` allows the dev server to read sibling spikes.

The contract fixture proves the path in a test. It renders sliders, a chart and readouts from `?seed=7&n=2000`. A new seed rewrites the hash and changes the readout, and a fresh tab with the original hash reproduces the original readout exactly.

## Charts and telemetry (owner feedback, 2026-11-24)

- **One chart grammar** (`src/stations/chart.tsx`) for every station and kernel:
  - round-number ticks, a light grid, labelled axes and a legend;
  - observed data in ink, theory and references in signal yellow, context in grey, highlighted regions in translucent yellow;
  - the series kinds `hist`, `pmf`, `pdf`/`line`, `ecdf`, `points`, `band` and `rule`.
- **Prototype methods now plot their real data** (`src/stations/method-series.ts`), computed from the same seeded prefix. The old 48-draw trace is gone.
  - Convergence: the running mean x̄ₖ inside the μ ± 2σ/√k band.
  - Estimation: the histogram with the x̄ ± 1.96·s/√n band and the true μ.
  - Confidence Intervals: the Chebyshev interval over k against μ.
  - Hypothesis Testing: the null Binomial(n, ½) with the as-or-more-extreme tail and the observed K.
  - Randomness: the null distribution of the runs count with E R and the observed R.
- **Card telemetry**: larger values, a taller mini chart, and higher-contrast labels and console.
- **Decorative glyphs removed.** The unused static plate glyphs (terrain, bell fan, trajectories) are deleted, as the owner asked: decorative visuals stay only if they are driven by real data.

## Fixes after an independent check

- A malformed `%` escape in a link no longer blanks the program.
- Seeds and numbers in the hash are parsed strictly, with the same rules as the seed field.
- A second `?` is treated as `&`.
- `#workspace?seed=…` works.
- Parameters keep both ends of their range reachable and tolerate `step: 0` and a reversed range.
- Kernel results are validated.
- An error boundary keeps a failing station inside its dock.
- The legacy stations honour `?seed=`.
- "Run" is disabled while the result is already up to date.
- A contract-fixture kernel (`spikes/scene-module-host/kernel.mjs`, hidden station `#station/contract-fixture`) exercises the kernel path end to end.

## Evidence

`PORT=4191 npx playwright test` in `spikes/visual-foundation`: **24 passed**. The suite has the 12 prototype tests, adapted to orbit navigation, 6 scene tests in `tests/scene.spec.mjs` and 6 station tests in `tests/stations.spec.mjs` (route parsing, parameter snapping, chart ticks, the fixture kernel and its URL replay, a broken link, legacy seeds). The scene tests check:

- At 1280×720, none of 16 views (four orbits, ten stations, two drawers) makes `scrollHeight` larger than `innerHeight`. The globe and the orbit switcher stay visible.
- The header has four orbit links and no separate views. Drawers open in place.
- A station URL with a seed and parameters reopens the same station in a fresh tab.
- With the keyboard, Enter opens each Probability station and focuses the dock title, while the cards are `inert`. Escape closes the dock and focus returns to the same card.
- The legacy `#module/…` and `#workspace` links open inside the scene.
- With reduced motion, the dock opens without animation.

`npm run build` (tsc and vite) passes.

Checked against the bundled Web Interface Guidelines (skill `web-design-guidelines`):
- The URL reflects state, and the views are deep-linkable.
- `overscroll-behavior: contain` on scrolling panels.
- `color-scheme: dark` is set.
- Icon buttons have labels.
- Reduced motion is honoured.
- Numbers in the readouts use tabular figures.
- Focus returns to the opener.

## Limits and open points

- Below 760 px wide the scene keeps one screen, but the station rail scrolls inside the field. Phones are not a target.
- The prototype's projector mode moved into the Distribution Explorer dock next to Export CSV.
- Station names and the orbit layout follow the lecture map, and the owner may rename or regroup them. Visual polish of the dock and the cards (spacing, motion) is the owner's.
- The Bayes, Urn and other lecture stations show "kernel in progress" until #38–#47 land.

## Position

Keep this host as the integration point for every lecture kernel. Kernel authors only add `spikes/<id>/kernel.mjs`. Registering a station is one entry in `catalog.ts`. The production version (after the PRD) should keep the same route grammar and the dock pattern.
