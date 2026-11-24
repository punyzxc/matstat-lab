# Frontend scaffold spike (#31)

Throwaway spike for `docs/research/frontend-scaffold.md`. It is laid out exactly as the future `web/`,
so the move after kickoff is `git mv spikes/frontend-scaffold web` plus the maintainer changes listed in the doc.

Static Vite + React + TypeScript. No server process: `vite build` writes `dist/`, and any static host serves it.
`vite preview` below is only a local static file server for the browser test.

## Steps (clean clone, Node 22.12+ or 24)

```sh
cd spikes/frontend-scaffold
npm ci                      # exact versions from package-lock.json
npm run lint                # tsc --noEmit
npm test                    # Vitest: pure run, Worker (shimmed by @vitest/web-worker), IndexedDB (fake-indexeddb), area boundaries
npx playwright install chromium   # once per machine / CI runner; locally the installed Chrome is used instead (PW_CHANNEL)
npm run e2e                 # tsc, `vite build --mode smoke`, then Playwright against `vite preview` on port 4231 (PORT=... to change)
npm run build               # production build: index.html only, no smoke page
```

Local runs use the installed Google Chrome (`channel: 'chrome'`). With `CI` set, Playwright uses its own Chromium,
so CI needs `npx playwright install --with-deps chromium` first. `PW_CHANNEL` overrides either.

## Layout

```
index.html                       product entry: mounts the one Orbital scene (src/app)
smoke.html                       test-only entry used by tests/e2e, built only in `--mode smoke`
src/app/                         owner-managed shell; scene-host.tsx is the mount slot for the Orbital scene
src/smoke/                       test-only page
src/functional/statistics/       area: statistics     (seeded PRNG)
src/functional/simulation/       area: simulation     (Worker protocol, pure run, Worker, client)
src/functional/inference/        area: inference      (empty)
src/functional/research-data/    area: research-data  (IndexedDB journal)
src/functional/adapters/         area: web (captain)  the only place UI meets the functional packages
tests/unit/                      Vitest
tests/e2e/                       Playwright, against the built app
```
