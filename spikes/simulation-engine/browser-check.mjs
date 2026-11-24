import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = new URL('../../docs/research/assets/simulation-engine/', import.meta.url);
await mkdir(output, { recursive: true });
const hardware = process.env.EVIDENCE_HARDWARE ? JSON.parse(await readFile(process.env.EVIDENCE_HARDWARE, 'utf8')) : { status: 'not supplied' };
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.STUDY_URL || 'http://127.0.0.1:4182/');
  await page.waitForFunction(() => typeof window.simulationEvidence === 'function');
  const evidence = await page.evaluate(async () => {
    let beats = 0;
    const timer = setInterval(() => beats++, 10);
    try { return { ...(await window.simulationEvidence()), mainThreadTimerCallbacks: beats }; }
    finally { clearInterval(timer); }
  });
  assert.deepEqual(errors, []);
  assert.ok(evidence.mainThreadTimerCallbacks > 1, 'Main thread must continue handling tasks');
  evidence.browser = browser.version(); evidence.hardware = hardware;
  await writeFile(new URL('browser-evidence.json', output), JSON.stringify(evidence, null, 2) + '\n');
  const node = JSON.parse(await readFile(new URL('node-evidence.json', output), 'utf8'));
  const comparison = { absoluteTolerance: 1e-12, relativeTolerance: 1e-12, resultsCompared: 0, exactResults: 0, numericValuesCompared: 0, maxAbsoluteDifference: 0, maxRelativeDifference: 0, withinTolerance: true };
  function compare(a, b) {
    assert.equal(typeof a, typeof b);
    if (typeof a === 'number') {
      comparison.numericValuesCompared++;
      const absolute = Math.abs(a - b), relative = absolute / Math.max(Math.abs(a), Math.abs(b), Number.MIN_VALUE);
      comparison.maxAbsoluteDifference = Math.max(comparison.maxAbsoluteDifference, absolute);
      comparison.maxRelativeDifference = Math.max(comparison.maxRelativeDifference, relative);
      assert.ok(absolute <= comparison.absoluteTolerance + comparison.relativeTolerance * Math.max(Math.abs(a), Math.abs(b)), 'Cross-runtime fixture exceeded its declared comparator');
    } else if (a && typeof a === 'object') {
      assert.deepEqual(Object.keys(a), Object.keys(b));
      for (const key of Object.keys(a)) compare(a[key], b[key]);
    } else assert.equal(a, b);
  }
  for (const key of ['replay', 'convergence']) {
    assert.equal(node[key].length, evidence[key].length);
    for (let i = 0; i < node[key].length; i++) {
      compare(node[key][i].result, evidence[key][i].result);
      comparison.resultsCompared++;
      if (node[key][i].sha256 === evidence[key][i].sha256) comparison.exactResults++;
    }
  }
  await writeFile(new URL('cross-runtime.json', output), JSON.stringify({ node: node.runtime, browser: evidence.browser, hardware, ...comparison }, null, 2) + '\n');
  console.log(JSON.stringify({ browser: evidence.browser, replayCases: evidence.replay.length, lifecycleTrials: evidence.lifecycle.length, mainThreadTimerCallbacks: evidence.mainThreadTimerCallbacks, comparison }));
} finally { await browser.close(); }
