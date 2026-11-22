# Distribution Explorer visual prototype

Run from this directory with Node.js 22+.

~~~powershell
npm ci
npm run dev -- --host 127.0.0.1 --port 4175
~~~

Open [the local workspace](http://127.0.0.1:4175/). Use Histogram, ECDF, or ASCII to inspect one sample. Change the distribution, its parameter, the sample size, or the seed and run the experiment. Export CSV to inspect the exact drawn values.

`npm test` checks sampling and aggregation. `npm run build` checks TypeScript and production bundling. `npm run e2e` runs the browser checks with Google Chrome installed.

This is a standalone Discovery spike. It tests the visual direction and browser interaction. The production architecture, worker contract, and final chart stack are decided through Discovery and the reviewed PRD.

[Findings and screen preview](../../docs/research/visual-foundation.md)
