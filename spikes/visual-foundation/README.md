# Orbital Laboratory

Run the Discovery prototype with Node.js 22.18+ and installed Chrome for browser tests.

~~~powershell
npm ci
npm run dev -- --host 127.0.0.1 --port 4175
~~~

Open [the orbital laboratory](http://127.0.0.1:4175/). The six windows open the corresponding experiments. Hover or focus a window to trace its connection to Earth. Rotate Earth by dragging or with the arrow keys while the globe has focus. The scene pause control also pauses links and result previews.

A window shows the most recent result saved for that module in this browser. A window without a saved result shows a labeled example computed from the active sample. Choose a model or resample to produce a new Distribution Explorer result. In the other instruments, change the sample prefix or select **Save result** to save the displayed analysis. **Use active sample** switches a saved instrument to the current Distribution Explorer sample when they differ.

Every experiment plays by itself: it opens, grows its sample and keeps drawing fresh ones. **Space** stops or plays it, **N** draws once more, and the pace switch (½× to 4×) sets the speed. Any parameter change runs at once; there is no Run button. Each slider has a box for typed values (`0,5`, `20 000`, `1/3`, `π/4`, `5%`); values outside the range are clamped and the box says so. Parameters with named values (law, view, hypothesis) are rows of choices. A kernel station follows one readout across draws (pick it with the pulse icon) and can stack the last draws into a rotatable **3D draws** landscape. Kernels run in a worker, so heavy simulations never freeze the scene. With reduced motion an experiment opens stopped.

[Distribution Explorer](http://127.0.0.1:4175/#module/distribution) provides seeded runs, histogram, ECDF, ASCII rendering, a bin table, and raw CSV. The secondary trefoil study is available below the sample record.

Run `npm test`, `npm run build` and `npm run e2e` here. [Design rationale and captures](../../docs/research/visual-foundation.md)
