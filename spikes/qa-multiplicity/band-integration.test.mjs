// Existing binomial implementation is the system under test, not the oracle.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { acceptanceBand } from '../inference-methods/inference.mjs';

const evidence = JSON.parse(readFileSync(new URL('./evidence.json', import.meta.url), 'utf8'));
for (const row of evidence.coverageBands) {
  test(`independent 80-digit band vs existing codec: ${row.policy}, R=${row.R}`, () => {
    const actual = acceptanceBand(row.R, .95, Number(row.alpha));
    assert.deepEqual([actual.lo, actual.hi], [row.lo, row.hi]);
    assert.ok(Number(row.actualSize) <= Number(row.alpha));
  });
}
