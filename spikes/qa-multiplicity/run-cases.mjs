// Feasibility evidence for the proposed fixed manifest. Not product/CI wiring.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { coverage, normalSampler } from '../inference-methods/inference.mjs';
import { createEngine, advance, finish } from '../simulation-engine/engine.mjs';

const policy = JSON.parse(readFileSync(new URL('./evidence.json', import.meta.url), 'utf8'));
const results = [];
for (const schedule of ['pr', 'nightly']) {
  const R = schedule === 'pr' ? 2000 : 20000;
  for (const item of policy.mandatoryCases) {
    if (item.family === 'coverage') {
      const result = coverage({ method: item.method, n: item.n, R, seed: item.seed,
        mu: item.mu, sigma: item.sigma,
        draw: rand => { const z = normalSampler(rand); return () => item.mu+item.sigma*z(); } });
      assert.equal(result.ok, true);
      assert.equal(result.failures, 0);
      const band = policy.coverageBands.find(row => row.R === R && row.policy === 'recommended-9-per-run-2-runs');
      const pass = result.hits >= band.lo && result.hits <= band.hi;
      results.push({ schedule, id: item.id, seed: item.seed, R, hits: result.hits, band: [band.lo,band.hi], pass });
      assert.ok(pass, `predeclared coverage band failed: ${item.id}`);
    } else {
      const spec = { ...item[schedule], seed: item.seed, experiment: item.experiment,
        model: item.model, retain: 256, engineVersion: item.engine, rngVersion: item.referenceRng };
      const state = createEngine(spec);
      while (!state.done) advance(state, 2048);
      const result = finish(state);
      const band = policy.meanBands.find(row => row.R === R && row.model === item.model);
      const pass = result.mean >= band.lower && result.mean <= band.upper;
      results.push({ schedule, id: item.id, seed: item.seed, N: spec.n*spec.repetitions,
        mean: result.mean, band: [band.lower,band.upper], pass });
      assert.ok(pass, `predeclared concentration band failed: ${item.id}`);
    }
  }
}
const evidence = { runtime: process.version, scope: 'Fixed reference-spike runs only; not empirical FWER calibration or product acceptance', results };
writeFileSync(new URL('./observed.json', import.meta.url), JSON.stringify(evidence, null, 2)+'\n');
console.log(`${results.length} predeclared case executions passed; no seeds or bands were changed`);
