# Orbital atmosphere compositing spike — issue #12

Throwaway Discovery evidence. Nothing here is product code or a decision to adopt this renderer.

## Run

From the repository root, with Node.js 22 or newer:

```sh
node spikes/orbital-atmosphere/serve.mjs
```

Open <http://127.0.0.1:4178/>. No npm installation, build step, fonts, network services, or API keys are needed to run the study.

Reproducible stills use `/?paused=1&time=6`; the comparison baseline adds `&baseline=1` to disable the atmosphere while retaining the same globe and UI. These are control/treatment fixtures, not before/after releases of a shipped app.

## Check

```sh
node --test spikes/orbital-atmosphere/atmosphere.test.mjs
```

Browser checks require an already installed Playwright package and Chrome. The checker resolves `playwright` normally; optionally set `PLAYWRIGHT_MODULE` to its installed package directory and `PLAYWRIGHT_CHANNEL` to another installed Chromium channel. It does not download dependencies or browsers.

```sh
node spikes/orbital-atmosphere/browser-check.mjs
```

The checker requires the server to be running and writes its evidence under `docs/research/assets/orbital-atmosphere/`. Set `STUDY_URL` to use another local port. It exercises 1440 and 390 px views, six routes, pause, live reduced-motion changes, a **simulated** document-visibility transition, manual globe controls, keyboard resampling, reserved-region clearance, and a six-second warm profile per viewport. Browser startup and assertion failures exit nonzero.

## Ownership

- `model.mjs`: transparent glyph drawing, layer assignment, conservative omission when a glyph intersects a reserved rectangle, and the cancelable motion lifecycle.
- `fixtures.mjs`: invented screen-space keyframes, visibility flags and 400 ms appearance envelopes. These are not orbital mechanics.
- `study.mjs`: a cached synthetic Earth, one visible Canvas2D surface, independent DOM instruments, and measurement instrumentation.
- The globe's ellipse-based land patches and the other instrument readouts are explicitly synthetic. Only the resampled uniform mean is calculated from a sample; no inference or geographic accuracy is claimed.
- Issue #11 owns production projection and collision rules; issue #5 owns the eventual art catalog. This study changes neither their files nor `contracts/`.

Read [the research and measured limitations](../../docs/research/orbital-atmosphere.md) before reusing a finding. Rewrite accepted ideas in the eventual product after the plan; do not move this spike into product code.
