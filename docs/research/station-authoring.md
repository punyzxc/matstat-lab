# Station authoring guide: one kernel file and one catalog entry

Issue #99 · Vision #83 · Contract: `spikes/visual-foundation/src/stations/kernel-contract.ts`

A **station** is one experiment on the Orbital laboratory scene. You write a **kernel**: a plain ES module that
turns parameters and a seed into numbers, curves and (optionally) a 3D surface. The scene does everything else:
the dock, sliders with typed boxes, autoplay, the URL, the chart, the 3D view, the across-draws trace, the
Web Worker. A new station is therefore two files you add and one line you add:

| Step | File | What |
|---|---|---|
| 1 | `spikes/<kernel-id>/kernel.mjs` | the kernel (copy `spikes/station-template/`) |
| 2 | `spikes/<kernel-id>/kernel.test.mjs` | node tests for the kernel |
| 3 | `spikes/visual-foundation/src/stations/catalog.ts` | one `stations` entry |

The template, `spikes/station-template/`, is a complete toy station (two dice: the law of the sum or the
maximum, plus the joint law in 3D). `preview.png` in that folder shows what it looks like on the scene with
the catalog entry from step 3.

**Worked examples (merged PRs):**
- [#106](https://github.com/GredesCerber/matstat-lab/pull/106): Hypothesis Testing, a new station inside an existing
  kernel, with a 3D power surface and a catalog entry that replaces a legacy station.
- [#120](https://github.com/GredesCerber/matstat-lab/pull/120): Scatter, new typed parameters, a typeset readout and a
  degenerate 3D case explained in a caption.

---

## 1. The kernel

Copy the template and rename it:

```sh
cp -r spikes/station-template spikes/my-kernel
```

A kernel exports `meta`, `run` and, when it serves stations, `stations`
(`Kernel` in `kernel-contract.ts`):

```js
export const meta = { id: 'my-kernel', lectures: ['L5'], title: 'Readable title with $\\LaTeX$', params };
export const stations = { 'my-station': { params, live: true } };
export function run(params, { seed, station }) { return { readouts, series, notes, axes, surface }; }
```

Rules the host and the tests rely on:

- **No DOM, no `Math.random`.** All randomness comes from `fixtureUint32(seed, stream, index, namespace)` in
  `spikes/simulation-engine/engine.mjs`. Pick your own `namespace` constant and one `stream` number per
  random quantity, and index draws by their position. Same params and seed must give the same bytes.
- **Pure and fast.** The host runs `run` in a Web Worker on every draw. Autoplay waits `max(1.1 s, 3 × run time)`
  between draws, so a run of a few hundred milliseconds still plays smoothly; cache anything that does not
  depend on the seed (see `powerSurface` in `spikes/lecture-hypothesis-tests/kernel.mjs`).
- **`station`** is the catalog id that asked; one kernel may serve several stations (`stations` map).

### Parameters: `KernelParam`

`{ key, label, min, max, step, default }`. The host resolves them with `resolveParams` (clamped to
`[min, max]`, snapped to `step` from `min`) before `run` sees them, and writes them into the URL.

- Every parameter gets a **slider and a typed box**. People type `0,5`, `20 000`, `1/3`, `π/4`, `5%`; the box
  parses, clamps and snaps. You do nothing for this.
- **Named choices.** An integer parameter (`step: 1`, at most 8 values) whose label ends in
  `(0 first, 1 second, …)` becomes a row of chips: `'Show (0 the sum $X_1 + X_2$, 1 the maximum)'`.
- **The size parameter** grows on open: the first parameter found among keys `R`, `N`, `n`, `reps` with
  `max ≥ 50` is ramped from 2 % to 100 % so the sample visibly builds up, then each draw uses a new seed.
- `stations[id].live: true` re-runs the kernel on every slider move and morphs the output.

### Output: `KernelResult`

`{ readouts, series, notes, axes?, surface? }`

- **`readouts: Readout[]`**: `{ key, label, observed?, theory?, unit?, convention? }`. One table row each; the host
  formats numbers. A numeric `observed` gets a "follow across draws" button; with a numeric `theory` the trace
  draws the theory line, so a share that converges (to $\alpha$, to $p$) is visible over draws.
  `observed`/`theory` may also be text with `$…$` formulas (a decision, a fitted line).
- **`series: Series[]`**: `{ id, kind, x, y, y2?, unit?, label?, tone? }` on one chart.
  `kind`: `pmf`, `pdf`, `cdf`, `hist`, `ecdf`, `line`, `points`, `band` (between `y` and `y2`), `rule` (a vertical
  line at `x[0]`). `tone`: `default` (observed), `signal` (theory), `muted` (context), `accent` (critical region,
  highlight). Keep `id`, `kind` and array lengths stable when only values change: the chart tweens between runs.
- **`notes: string[]`**: "Reading the result", one short paragraph each.
- **`axes: { x?, y? }`**: axis titles.
- **`surface?: Surface`**: the rotatable 3D view, `{ x, y, z, zSample?, labels, title?, sampleLabel? }` on a regular
  grid up to about 41 × 41. `z[j][i]` is the theory at `(x[i], y[j])`; `zSample[j][i]` is the observed value on the
  same grid, drawn as stems; `labels: { x, y, z }`; `sampleLabel` names the stems in the legend (default:
  "Sample density (2D histogram)").

### Formulas

Every formula is written in `$…$` and typeset with KaTeX: labels, conventions, notes, axes, surface titles,
parameter labels, catalog summaries. Never plain text like `p^k*(1-p)^(n-k)` or `σ²`. Display-style fractions:
`\dfrac{a}{b}`. `spikes/visual-foundation/tests/kernel-math.test.mjs` runs **every** `spikes/*/kernel.mjs` and fails on
a formula KaTeX cannot render or on formula-looking text outside `$…$`.

## 2. Tests

`kernel.test.mjs` next to the kernel, run with `node --test spikes/my-kernel/kernel.test.mjs`. The template has the
minimum set: exact values, the contract shape (aligned finite arrays, defaults in range, every station runs),
determinism (same seed, same bytes; new seed, new sample) and an agreement test with a **predeclared** band
(for example 4 standard errors, or an exact binomial band as in `acceptanceBand` of the hypothesis kernel).

For browser behaviour add a Playwright spec in `spikes/visual-foundation/tests/` (see
`hypothesis-testing.spec.mjs`): open `/#station/my-station?seed=…&n=…`, check the heading, a readout row, a
typed value, and that the same URL in a fresh page shows the same numbers.

## 3. The catalog entry

`spikes/visual-foundation/src/stations/catalog.ts`, one object in `stations` (type `KernelStation`):

```ts
{ kind: 'kernel', id: 'dice-template', name: 'Two dice', orbit: 'variables', lectures: 'L5',
  kernel: 'station-template', issue: 99, hidden: true,
  summary: 'Roll two dice; compare the law of their sum with the exact $\\dfrac{6 - |k - 7|}{36}$.' },
```

- `kernel` is the folder name under `spikes/`; `id` must be a key of the kernel's `stations` (or the kernel
  ignores `station`).
- `orbit`: `probability` (L1–L3), `variables` (L4–L6), `limits` (L6–L9), `statistics` (L10–L12).
  **An orbit shows at most six stations**; check `stationsOf(orbit)` before adding a visible one, or replace one
  with the owner's agreement.
- `hidden: true` keeps a station off the orbit but reachable at `#station/<id>`: use it while you build.
- `lectures` follows the lecture content (L11 estimation, L12 hypothesis testing; the PDF headings of these two are swapped).

Then run the lab (`cd spikes/visual-foundation && npm ci && npm run dev -- --host 127.0.0.1 --port 4175`) and open
`http://127.0.0.1:4175/#station/dice-template`. A lecture step links to it with
`"experiment": { "station": "dice-template", "seed": 5, "params": { "n": 1200 } }` (`lectures/README.md`).

### Russian

The lab opens in Russian; the **EN** switch shows English (`spikes/visual-foundation/i18n/README.md`). Write the
kernel and the catalog entry in English, then:

- add the station's Russian `name` and `summary` to the `ru` table under `stations` in `catalog.ts`;
- write `spikes/visual-foundation/i18n/ru/kernels/<kernel>.json` (start from `station-template.json`): every text
  the kernel shows, with `[[1]]`, `[[2]]`… for computed parts. `node tests/i18n-kernel-texts.mjs <kernel>` lists
  what is left; terms follow `i18n/glossary.md`.

`tests/i18n.test.mjs` fails while any text of the kernel stays English.

## 4. The owner's checklist (every station must pass)

From @punyzxc, 2026-11-25. Review against this before you open the PR.

- [ ] **Fullscreen scene.** The station lives in the scene's dock; no new page, window, tab or popup.
- [ ] **The globe is not yours.** No globe pause or mode buttons; nothing stops the Earth turning.
- [ ] **Autoplay.** It runs live as soon as it opens: no Run button. The shared play bar gives Stop/Play,
      one more draw (N), start over and pace; do not add your own.
- [ ] **Keyboard input everywhere.** Every value a person might want is a parameter, so it can be typed;
      the experiment reacts at once.
- [ ] **Russian first.** Every text in Russian with the Russian terms of the course; English only on the EN switch.
- [ ] **Textbook formulas.** Every formula in `$…$` (KaTeX), `\dfrac` for fractions; `kernel-math.test.mjs` is green.
- [ ] **Real data only.** Every curve, stem and number comes from the seeded run or from exact theory; nothing
      decorative that is not live.
- [ ] **Teaching value.** Theory next to experiment (`observed` and `theory`), a convergence worth following
      across draws, notes that explain what to look at; consider a 3D `surface` when two parameters matter.
- [ ] **Reproducible.** Same URL, same numbers; tests prove it.
- [ ] **Polished.** No clipped text at 1366 × 768 and larger, no horizontal scroll, stable series ids
      (smooth tweens), degenerate inputs (an edge of a range, $\rho = \pm 1$, $n = 2$) explained instead of
      breaking.

## 5. Ship it

`npm test`, `npm run build` and `npx playwright test --trace off` in `spikes/visual-foundation`, plus your kernel
tests. GitHub Actions is locked by billing, so paste the summary into the PR. Work cycle and review rules:
`AGENTS.md`.
