# Simulation Worker execution fixture — #14

Standalone Discovery evidence, not production code. The two model transforms and `fixture-mix32-v1` are deliberately provisional inputs so execution research does not depend on #13's statistical engine.

## Reproduce without installing packages

Node.js 22+ is required; the recorded session used Node 24.15.0.

```sh
node --test spikes/simulation-engine/*.test.mjs
node spikes/simulation-engine/evidence-node.mjs
node spikes/simulation-engine/serve.mjs
```

Open <http://127.0.0.1:4182/> for the unstyled browser execution harness. The button runs real browser module Workers and displays evidence; it does not change the product interface.

For browser automation, use an already installed Playwright package and Chrome:

```sh
node spikes/simulation-engine/browser-check.mjs
```

The browser check expects the local server and previously generated Node evidence. Set `PLAYWRIGHT_MODULE` to an installed Playwright package directory when normal package resolution does not find it; `PLAYWRIGHT_CHANNEL` defaults to `chrome`. No package or browser is downloaded automatically. `STUDY_URL` can select another local URL; `PORT` changes the server's default 4182.

Set `EVIDENCE_HARDWARE` to a JSON file containing the test machine's CPU model, core counts, RAM and OS before running both evidence scripts. Otherwise the new evidence explicitly says hardware was not supplied. Do not reuse the recorded hardware identity for another machine.

Evidence is written under `docs/research/assets/simulation-engine/`. Node/browser timings are measured sequentially, not concurrently.

## Modules and boundaries

- `engine.mjs`: versioned fixture draws, request limits, stable per-draw reductions, LLN prefix checkpoints, separate CLT replicate means, complete histograms and bounded retained arrays.
- `worker.mjs`: cooperative 4 ms / 2048-draw chunks, timeout or hybrid MessageChannel scheduling, pause/resume/cancel and transfer of bounded result buffers.
- `controller.mjs`: run/epoch/version/sequence checks, terminal-state handling, cancellation acknowledgement with a termination fallback, one retained committed result.
- `node-worker.mjs`: a small bridge to exercise the same browser-compatible Worker code in Node worker_threads.
- `evidence.mjs`: seven replay cases, eight active-run lifecycle trials and four convergence fixtures. Comparisons exclude transport cadence and timing metadata.
- `*.test.mjs`: eleven tests, including regressions for message-source starvation, terminal races and rejected-message sequence poisoning.

The detailed [research report](../../docs/research/simulation-engine.md) distinguishes facts from assumptions, names the hardware, documents numerical and memory limits, and records unresolved production decisions. Do not move this spike into the product after Discovery; implement reviewed production contracts separately.
