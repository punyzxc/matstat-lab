import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { RunController } from './controller.mjs';
import { createEngine, advance, finish, canonical, ENGINE_VERSION, RNG_VERSION } from './engine.mjs';

const spec = { experiment: 'clt', model: 'exponential', seed: 2048, n: 17, repetitions: 31, retain: 31, engineVersion: ENGINE_VERSION, rngVersion: RNG_VERSION };
function factory() {
  const worker = new Worker(new URL('./node-worker.mjs', import.meta.url));
  const adapter = {
    postMessage: (...args) => worker.postMessage(...args),
    terminate: () => worker.terminate(),
    set onmessage(callback) { worker.on('message', data => callback({ data })); },
    set onerror(callback) { worker.on('error', callback); },
  };
  return adapter;
}

test('AC1: real Worker results replay across timeout/message scheduling and batch sizes', async () => {
  const state = createEngine(spec); while (!state.done) advance(state, 2048);
  const expected = canonical(finish(state));
  for (const [batchSize, scheduler] of [[1, 'timeout'], [7, 'message'], [2048, 'timeout']]) {
    const controller = new RunController(factory);
    try {
      const run = controller.start(spec, { batchSize, scheduler });
      const result = await run.completion;
      assert.equal(canonical(result), expected);
      assert.equal(controller.snapshot().workerRetainedBytes, 0);
    } finally { controller.dispose(); }
  }
});

test('AC2: real Worker pauses without progress, resumes, cancels and restarts', async () => {
  const controller = new RunController(factory);
  const long = { ...spec, n: 250, repetitions: 8000, retain: 64 };
  try {
    const first = controller.start(long, { batchSize: 256, scheduler: 'message' });
    await controller.waitFor('running');
    await controller.pause();
    const paused = controller.snapshot();
    assert.equal(paused.state, 'paused');
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(controller.snapshot().processed, paused.processed);
    await controller.resume();
    assert.equal(controller.snapshot().state, 'running');
    const cancelled = await controller.cancel();
    await assert.rejects(first.completion, /cancel/i);
    assert.equal(cancelled.acknowledged, true);
    assert.equal(cancelled.workerRetainedBytes, 0);
    assert.equal(cancelled.terminated, true);
    const restarted = controller.start(spec, { batchSize: 64, scheduler: 'message' });
    const result = await restarted.completion;
    assert.equal(controller.snapshot().state, 'completed');
    assert.equal(result.repetitions, 31);
  } finally { controller.dispose(); }
});

test('AC2: superseded run and stale revisions cannot replace a valid committed result', async () => {
  const workers = [];
  const controller = new RunController(() => { const w = { postMessage() {}, terminate() {}, onmessage: null, onerror: null }; workers.push(w); return w; });
  try {
    const old = controller.start(spec);
    const staleCallback = workers[0].onmessage;
    const next = controller.start({ ...spec, seed: 99 });
    await assert.rejects(old.completion, /supersed/i);
    const committed = { marker: 'valid result', means: new Float64Array([0.5]) };
    workers[1].onmessage({ data: { type: 'completed', runId: next.runId, sequence: 2, engineVersion: ENGINE_VERSION, result: committed, retainedBytes: 0 } });
    await next.completion;
    staleCallback({ data: { type: 'completed', runId: old.runId, sequence: 999, engineVersion: ENGINE_VERSION, result: { marker: 'stale' } } });
    workers[1].onmessage({ data: { type: 'completed', runId: next.runId, sequence: 1, engineVersion: ENGINE_VERSION, result: { marker: 'out-of-order' } } });
    assert.equal(controller.committed, committed);
    assert.equal(controller.snapshot().rejectedEvents, 2);
  } finally { controller.dispose(); }
});
