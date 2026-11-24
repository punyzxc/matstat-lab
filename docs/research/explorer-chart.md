# Versioned experiment results

## Facts verified in the spike

- A completed snapshot preserves the experiment ID, module ID, run ID, source and duration, distribution parameters, seed, RNG and algorithm versions, theoretical and empirical results, warning codes and exact chart coordinates. The checked fixture deliberately supplies hand-picked observations and labels its source as a fixture. [Fixture](../../spikes/explorer-chart/fixture.mjs) · [Codec](../../spikes/explorer-chart/snapshot.mjs)
- With observations 0, 0.5, 1, 1 and 3, the histogram on edges 0, 1 and 2 counts two draws in each bin and one above the domain. The right-continuous ECDF has cumulative counts 1, 2, 4 and 5 at its four distinct values. The codec rejects valid-looking totals with wrong per-bin or ECDF counts. [Numerical checks](../../spikes/explorer-chart/snapshot.test.mjs)
- Chrome restored the same record after a page reload. A second tab injected a supported older record plus future and corrupt records. Per-module lookup selected the supported record, reported the unreadable count, preserved the original data and did not consume a draw. A duplicate write aborted. Rename preserved finish time. Deleting the latest record made the previous record visible again. [Browser check](../../spikes/explorer-chart/browser.test.mjs)
- CSV emits exact retained draw order and values plus IDs, seed and algorithm versions. JSON retains the whole snapshot. The versioned report contains separate theoretical and observed measures, assumptions via warning codes, and retained/total draw counts. No PDF rendering is part of this check. [Exports](../../spikes/explorer-chart/snapshot.mjs)

## Assumptions and boundaries

The spike supports one bounded sample and two series. It validates the series against retained values on read since the fixtures are small. The experiment engine owns parameter domains, sampling and scientific calculations. The future schema needs per-experiment typed summaries, a separate version for the journal database, explicit approximation or truncation metadata, and validation costs measured at production sizes. Its validator can validate a typed aggregate directly when raw data is not retained. Use a versioned series variant for each experiment and use schema-specific migration functions. The fabricated version 0 exists to exercise the compatibility path.

Order latest completed results by finish time and stable experiment ID. Preserve incompatible records for recovery and surface explicit unreadable counts. Expose browser storage errors and retain unsaved results in memory. The owning team should verify quotas, cross-browser behavior and retention before choosing production budgets. [IndexedDB transactions and schema upgrades](https://www.w3.org/TR/IndexedDB/)

## Position

Use a completed snapshot as the common consumer boundary. Store prepared numerical series with it and replay only on an explicit user action. The producer and consumer can independently test fixture payloads. A UI preview uses the latest compatible committed record or a clearly marked empty state. Adopt a production contract only after scientific QA, simulation and consumer review.

## Reproduce

From `spikes/explorer-chart`, run `node --test snapshot.test.mjs`. To run `node --test browser.test.mjs`, make the existing Playwright package available through `PLAYWRIGHT_MODULE` or Node module resolution. Chrome is the default channel and `PLAYWRIGHT_CHANNEL` can select another installed channel. The test launches its own loopback server.
