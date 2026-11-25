# Independent scene acceptance audit (#56)

Research-only browser checks. They import Playwright from the existing visual spike's locked dependencies, but do not import its router, station catalog, kernels or tests. No visual-spike source file is edited.

From the repository root, install the existing dependencies and start the subject in terminal 1:

```powershell
npm --prefix spikes/visual-foundation ci --no-audit --no-fund
npm --prefix spikes/visual-foundation run dev -- --host 127.0.0.1 --port 4196 --strictPort
```

In terminal 2, run from this directory:

```powershell
$env:PORT = '4196'
node ../visual-foundation/node_modules/@playwright/test/cli.js test --config playwright.config.mjs
node collect-evidence.mjs
```

`PORT` points to an already-running server; this audit does not start or reuse an arbitrary server automatically. Both terminals must use the same port. The default browser is installed Microsoft Edge (`msedge`); set `AUDIT_BROWSER=chrome` to use installed Chrome. The recorded run only covers Edge. No browser download is needed for that run.

Raw runner output, failure traces and attachments go into ignored `results/`. `collect-evidence.mjs` extracts the JSON attachments, versions, source commit, statuses and one screenshot into committed `evidence.json` and `evidence/fixture-at-1280.png`. Run it after a completed test invocation, against the same unchanged subject checkout. The source commit in the recorded evidence predates this audit's own commit.

The inventory is intentionally explicit: four orbits, 19 visible stations, two hidden stations, two drawers. A new visible station makes the keyboard inventory count fail until reviewed. Adding another hidden station requires updating the explicit inventory. The detailed conclusions and limitations are in `../../docs/research/scene-acceptance-audit.md`.
