# Team preview

The branch `preview/discovery` brings together the current heads of PR #8 (functional plan and contracts), PR #9 (laboratory prototype), and PR #17 (separate orbital atmosphere study). Each PR still follows the normal review and protected merge process.

## Open the combined laboratory prototype

From a clean local clone with Node.js 22.18 or newer:

~~~sh
git fetch origin
git worktree add --detach ../matstat-lab-preview origin/preview/discovery
cd ../matstat-lab-preview/spikes/visual-foundation
npm ci
npm run dev -- --host 127.0.0.1 --port 4181 --strictPort
~~~

Open [Orbital Laboratory](http://127.0.0.1:4181/) or [Distribution Explorer](http://127.0.0.1:4181/#module/distribution). In the latter, use the same seed and settings to replay a sample. On returning to the observatory, the local preview shows its latest saved result.

## Open the separate study

From the root of the preview worktree in another terminal:

~~~sh
node spikes/orbital-atmosphere/serve.mjs
~~~

Open [Orbital atmosphere study](http://127.0.0.1:4178/). This is a Discovery experiment with synthetic scene data and an independent animation implementation. [Research report](research/orbital-atmosphere.md)

For the current scientific plan and parallel tracks see [PR #8](https://github.com/GredesCerber/matstat-lab/pull/8), [the PRD](prd.md) and [task dependencies](functional-iterations.md).
