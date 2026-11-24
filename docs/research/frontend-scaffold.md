# Static frontend scaffold: Vite, React, TypeScript, Workers, IndexedDB, Vitest, Playwright

**Fact — scope:** this answers [Discovery task #31](https://github.com/punyzxc/matstat-lab/issues/31). The executable evidence is the throwaway spike [`spikes/frontend-scaffold/`](../../spikes/frontend-scaffold/). It is laid out exactly as the future `web/`, so after kickoff the move is `git mv spikes/frontend-scaffold web` plus the maintainer changes below. No product code, `web/**`, `crew.config.json` or `.github/` is changed.

**Fact — product rule from the owner (2026-11-24):** STATUM LAB is one web program, not a site. The whole UI and navigation live on the single Orbital laboratory scene (prototype in `spikes/visual-foundation/`; scene host and kernel contract in [PR #49](https://github.com/punyzxc/matstat-lab/pull/49), lecture player in [PR #63](https://github.com/punyzxc/matstat-lab/pull/63), contract extensions `live`/`surface` in [PR #64](https://github.com/punyzxc/matstat-lab/pull/64)). The owner leads visuals. **So the scaffold adds no design:** its product entry mounts one empty slot, `src/app/scene-host.tsx`, where that scene moves in.

## Answer

Yes. A static Vite 7 + React 19 + TypeScript 5.9 app with no server process builds, runs a module Worker that posts progress and a result, writes and reads IndexedDB, and passes Vitest and Playwright locally. The three existing `web-*` crew checks already run it unchanged once it sits at `web/`. Playwright is not in `crew check` today, so a maintainer must add it (below).

## Acceptance criteria → evidence

### 1. Clean clone, Node 24, static build, no server

- **Fact:** `npm ci && npm run build` in `spikes/frontend-scaffold/` runs `tsc --noEmit && vite build` and writes only static files to `dist/` (`index.html`, `smoke.html`, hashed JS, and the worker as its own `assets/mean.worker-*.js`). Run on Node 24.21.0, npm 11.19.0, Windows 11. No Fastify, no `api/`, no server code: `package.json` has `react` and `react-dom` as its only runtime dependencies.
- **Fact:** Vite's production build is a static bundle meant for any static host; `vite preview` is only for previewing the build locally, not a production server. [Vite: deploying a static site](https://vite.dev/guide/static-deploy).
- **Fact (tested here):** "no server" means "served by any static host over http(s)", not `file://`. Opening `dist/smoke.html` from disk in Chrome fails: module scripts are blocked by CORS for the `file://` origin (`Cross origin requests are only supported for protocol schemes: … http, https …`). So the classroom route is a static host (Vercel, per [architecture](../architecture.md)) or `vite preview`, never a double-click on the file.
- **Fact:** `base: './'` makes the build path-independent (works from a sub-path on a static host). [Vite `base`](https://vite.dev/config/shared-options.html#base).
- **Fact:** the versions are pinned exactly and match `spikes/visual-foundation` (React 19.3.1, Vite 7.3.8, TypeScript 5.9.3, @playwright/test 1.65.1), so moving the scene in brings no version drift. Added for tests only: Vitest 5.1.1, @vitest/web-worker 5.1.1, fake-indexeddb 6.2.8.
- **Fact:** `engines` is `^22.12.0 || >=24.0.0`, because the CI workflow `.github/workflows/crew.yml` sets up Node **22**, not 24, and Vitest 5 declares `node: ^22.12.0 || ^24.0.0 || >=26.0.0` (its package.json). The clean-clone run was done on Node 24 only; **assumption:** Node 22.12 works, not measured on this machine.
- **Fact:** npm 11 warns that `esbuild`'s postinstall is "not yet covered by allowScripts". The build works without it (esbuild's platform binary comes as an optional dependency). Nothing to change; noted so nobody "fixes" it with `--force`.

### 2. Worker progress + result and IndexedDB write/read, in Vitest and Playwright

| Layer | Worker | IndexedDB | What it proves |
|---|---|---|---|
| Vitest (`npm test`, `vitest run`, Node) | `@vitest/web-worker` runs the worker module **in the same Node process** (a shim, no thread) | `fake-indexeddb` (in-memory) | message protocol, batching, reproducibility, error path; journal API |
| Playwright (`npm run e2e`, real Chrome) | real module Worker from the **built** `dist/` | the browser's real IndexedDB, re-read with a fresh connection from the test | the actual browser behaviour |

- **Fact (tested here):** `npm test` → 3 files, 7 tests pass: the pure run reports every batch (2500, 5000, 7500, 10000) and is reproducible for a seed; invalid sizes throw instead of looping; the Worker posts the same progress messages and the same result as the pure run; a bad spec becomes a rejected promise; a journal record survives close and reopen; the area-boundary test (next section).
- **Fact (tested here):** `npm run e2e` builds, starts `vite preview` on port 4231 (`strictPort`, `reuseExistingServer: false`) and passes 2 tests: the smoke page gets progress `2500,5000,7500,10000`, a mean in (0.45, 0.55) and the same mean back from IndexedDB, re-read from the page with a new `indexedDB.open`; the product entry mounts `main[data-scene-host]`.
- **Fact (found here):** `@vitest/web-worker` 5.1.1 cannot load a worker created as `new Worker(new URL('./x.ts', import.meta.url))` when the checkout path has non-ASCII characters; it looks for the percent-encoded path (`/C:/Users/%D0%94…`) and fails. The owner's Windows profile path is Cyrillic, so this hits every local run. Vite's `?worker` import (`import MeanWorker from './mean.worker.ts?worker'`) works in both Vitest and the build, so the spike uses it. [Vite: Web Workers](https://vite.dev/guide/features.html#web-workers). **Position:** product code uses the `?worker` form.
- **Fact:** Playwright uses the installed Google Chrome locally (`channel: 'chrome'`, because the bundled browsers are not installed on this machine) and its own Chromium when `CI` is set; CI needs `npx playwright install --with-deps chromium` first. [Playwright: CI](https://playwright.dev/docs/ci). `PW_CHANNEL` overrides both.
- **Fact:** the e2e test runs against the build, never against the dev server, and on its own port. Other checkouts already serve on 4175 (main) and 4191 (PR #49 preview); the visual-foundation config uses `reuseExistingServer: true` and would silently test whatever runs there.

### 3. Folder layout for the disjoint areas of #16, and which checks run

Paths follow [functional-areas.md](../functional-areas.md) and [architecture.md](../architecture.md) (proposed in [#16](https://github.com/punyzxc/matstat-lab/issues/16)).

```
web/
  index.html                         product entry: the one Orbital scene
  smoke.html                         test-only entry (tests/e2e)
  src/main.tsx                       mounts <SceneHost/>
  src/app/                           owner-managed shell: scene, orbits, SceneDock, station cards, lecture player
  src/styles/                        design area (already in crew.config.json)
  src/functional/statistics/         statistics      random/, distributions/, summary/, series/
  src/functional/simulation/         simulation      worker/, run/, convergence/
  src/functional/inference/          inference       estimation/, intervals/, hypothesis/
  src/functional/research-data/      research-data   journal/, export/, comparison/
  src/functional/adapters/           web (captain)   the only place UI meets functional code
  tests/unit/                        Vitest, next to the code it tests
  tests/e2e/                         Playwright (see the e2e ownership note)
```

- **Fact:** `src/functional/**` imports no React, CSS or `src/app/**`, and `statistics` imports no other area; only `adapters` (and `research-data` itself) import `research-data`. A Vitest test (`tests/unit/boundaries.test.ts`) enforces this, so a boundary break turns `web-test` red.

**Fact (tested here):** with the spike copied to a scratch `web/` and `npm --prefix web ci`, the three `web-*` commands from `crew.config.json`, run verbatim from the repo root, all pass, and `web-types` (`npm --prefix web exec -- tsc -b web --noEmit`) does fail on an injected type error, so it really checks.

**Fact:** `crew check` runs every configured step whose `when_exists` file exists; it does not select steps by changed path (see `crew.config.json` → `check`). So any change under `web/` runs the same set:

| Path | Area | `web-lint` (`tsc --noEmit`) | `web-types` (`tsc -b web`) | `web-test` (Vitest, incl. boundaries) | Playwright | `acceptance` |
|---|---|---|---|---|---|---|
| `web/src/functional/statistics/**` | statistics | yes | yes | yes | **not run today** | yes (node --test, separate) |
| `web/src/functional/simulation/**` | simulation | yes | yes | yes | **not run today** | yes |
| `web/src/functional/inference/**` | inference | yes | yes | yes | **not run today** | yes |
| `web/src/functional/research-data/**` | research-data | yes | yes | yes | **not run today** | yes |
| `web/src/functional/adapters/**`, `web/src/app/**`, `web/*.html` | web | yes | yes | yes | **not run today** | yes |
| `web/src/styles/**` | design | yes | yes | yes | **not run today** | yes |
| `tests/e2e/**`, `tests/acceptance/**`, `tests/fixtures/**` | e2e | yes | yes | yes | **not run today** | yes |

- **Fact:** the `api-types` and `api-test` steps are skipped because `api/` does not exist (`when_exists`), and `crew.yml` already runs `npm --prefix web ci` before `crew check` when `web/package-lock.json` exists. So Vitest and tsc work in CI with no workflow change; only Playwright needs one.

## What a maintainer would need to change (protected files; not changed here)

1. **`crew.config.json` → `areas`:** replace the `web: ["web/**"]` catchall with enumerated captain paths (`web/src/app/**`, `web/src/functional/adapters/**`, `web/src/main.tsx`, `web/*.html`, `web/*.json`, `web/*.ts`, `web/tests/**`) and add `statistics`, `simulation`, `inference`, `research-data` with their `web/src/functional/<area>/**` paths. Keep `design` on `web/src/styles/**` and make sure no two areas overlap. Add `tests/fixtures/**` to `e2e`.
2. **`crew.config.json` → `check`:** add `{ "name": "web-e2e", "run": "npm --prefix web run e2e", "when_exists": "web/playwright.config.ts" }`. Optionally make `web-lint` a real linter later; today it is `tsc --noEmit`.
3. **`.github/workflows/crew.yml`:** before `crew check`, add `npx --prefix web playwright install --with-deps chromium` (only when `web/playwright.config.ts` exists). Consider Node 24 instead of 22 to match the issue's baseline. Note: Actions are still locked by the billing issue, so today these run only locally.
4. **`crew.config.json` → `scaffold`:** drop the `api` line (Fastify) and the `npm create vite` line; the scaffold is this spike moved to `web/`. Remove the `api` area and its two checks, or leave them as no-ops.
5. **e2e ownership:** the spike keeps its Playwright specs in `web/tests/e2e/` so it is self-contained. The `e2e` area owns the root `tests/e2e/**`. **Position:** after the move, keep `web/playwright.config.ts` (captain) but point `testDir` at `../tests/e2e` so independent QA owns the specs; this needs only the `testDir` line changed.

## Migrating the Orbital scene and the lecture kernels into `web/`

**Position for the owner and the lecture-features thread, not a fact.** The scene (PR #49, #63, #64) is unmerged; this table maps today's spike files to their production home. Every move is a `git mv` plus import-path fixes; no redesign.

| Today | Production path | Area |
|---|---|---|
| `spikes/visual-foundation/src/{globe,lab-shell,observatory,orbit-*,plate-canvas,plot,specimen-view,ui,…}.tsx`, `orbital-atmosphere.ts`, `trefoil.ts`, `motion-preference.ts` | `web/src/app/scene/` | web (owner-managed) |
| `…/src/stations/{station-dock,station-card,kernel-station,chart}.tsx`, `route.ts`, `catalog.ts` | `web/src/app/stations/` | web (owner-managed) |
| `…/src/lectures/**`, `lectures/LNN.json`, `lectures/scientists.json` (#63) | `web/src/app/lectures/` | web (owner-managed) |
| `…/public/portraits/*.txt` (#63) | `web/public/portraits/` | web / design |
| `…/src/*.css`, `src/stations/scene.css` | `web/src/styles/` | design |
| `…/src/stations/kernel-contract.ts` (incl. `live`, `surface` from #64) | **position:** `contracts/kernel.ts`, re-exported from `web/src/functional/adapters/` | contracts (captain) |
| `spikes/lecture-*/kernel.mjs` | `web/src/functional/<area>/kernels/<id>/kernel.ts`; `catalog.ts` finds them with `import.meta.glob('/src/functional/*/kernels/*/kernel.ts')` instead of `spikes/*/kernel.mjs` | by content: combinatorics, geometric, Bayes, Bernoulli, random vectors → statistics; limit theorems → simulation; sampling/goodness-of-fit, estimation/intervals → inference |
| `spikes/*/kernel.test.mjs` (`node --test`) | `web/tests/unit/kernels/*.test.ts` (Vitest) | same area as the kernel |
| shared special functions (#54) | `web/src/functional/statistics/distributions/` | statistics |
| `…/src/statistics.ts`, `method-readouts.ts`, `last-results.ts` | statistics, inference and research-data respectively (`last-results` → the IndexedDB journal instead of localStorage) | as named |

**Assumptions:**
- Kernels are DOM-free (contract), so heavy runs can move into the simulation Worker with one generic `run kernel` message; `live` stations (#64) re-run every frame and should stay synchronous on the main thread. Not measured.
- The `vite.config` `server.fs.allow: ['..']` that PR #49 needs to read sibling spikes disappears once kernels live under `web/src/`.
- Moving the scene is one PR by the scene owner, after kickoff and after #49/#63/#64 merge; kernel moves can then go one PR per area.

## Position

Use this spike as `web/` at kickoff: static Vite + React + TypeScript, `?worker` module Workers, raw IndexedDB behind `research-data/journal`, Vitest (with the Worker shim and fake-indexeddb) for logic, and Playwright against the built app for the real browser. The product has one entry that mounts the Orbital scene; there is no router and no second page except the test-only smoke entry. The maintainer changes above are small: enumerated areas, one `web-e2e` check and one browser-install step.

**Unsure:** Node 22 in CI is not measured; Firefox and Safari were not run (Chrome only); the kernel-contract home (`contracts/` vs `adapters/`) and the e2e spec location are the owner's call.
