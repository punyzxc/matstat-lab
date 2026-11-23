# Probability Atlas prototype

Run the Discovery spike with Node.js 22.18 or later and Google Chrome for browser tests.

~~~powershell
npm ci
npm run dev -- --host 127.0.0.1 --port 4175
~~~

Open the [atlas](http://127.0.0.1:4175/). Choose a model, step through observations with the draw readout on the trefoil and compare the marker with the CDF value. Rotate the specimen by dragging or with the left and right arrow keys while it has focus. The scene controls switch between the knot and Earth, change rendering style, and pause motion.

Launch Distribution Explorer from the index or go directly to [the experiment](http://127.0.0.1:4175/#module/distribution). Run the simulation, inspect histogram, ECDF or ASCII output and export the raw observations. Return to the atlas to use the completed settings in the five numerical method previews.

Run `npm test`, `npm run build` and `npm run e2e` from this directory. [Design specification, evidence and previews](../../docs/research/visual-foundation.md)
