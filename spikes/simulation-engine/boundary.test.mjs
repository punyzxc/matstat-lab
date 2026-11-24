import test from 'node:test';
import assert from 'node:assert/strict';
import { RunController } from './controller.mjs';
import { ENGINE_VERSION } from './engine.mjs';
const spec = { experiment: 'clt', model: 'uniform', seed: 0, n: 4, repetitions: 3, retain: 3 };

test('AC2: a rejected message cannot poison the accepted revision sequence', async () => {
  let worker;
  const controller = new RunController(() => (worker = { postMessage() {}, terminate() {}, onmessage: null, onerror: null }));
  try {
    const run = controller.start(spec);
    worker.onmessage({ data: { type: 'running', runId: run.runId, sequence: 1, engineVersion: ENGINE_VERSION } });
    worker.onmessage({ data: { type: 'unknown-payload', runId: run.runId, sequence: 1000, engineVersion: ENGINE_VERSION } });
    const result = { means: new Float64Array([0.5]) };
    worker.onmessage({ data: { type: 'completed', runId: run.runId, sequence: 2, engineVersion: ENGINE_VERSION, result, retainedBytes: 0 } });
    assert.equal(controller.snapshot().state, 'completed');
    assert.equal(await run.completion, result);
    assert.equal(controller.snapshot().rejectedEvents, 1);
  } finally { controller.dispose(); }
});

test('AC2: missing cancellation acknowledgement uses termination and does not invent released-byte evidence', async () => {
  let terminated = 0;
  const controller = new RunController(() => ({ postMessage() {}, terminate() { terminated++; }, onmessage: null, onerror: null }));
  try {
    const run = controller.start(spec);
    const result = await controller.cancel();
    await assert.rejects(run.completion, /cancel/i);
    assert.equal(result.acknowledged, false);
    assert.equal(result.workerRetainedBytes, null);
    assert.equal(result.terminated, true);
    assert.ok(terminated >= 1);
  } finally { controller.dispose(); }
});
