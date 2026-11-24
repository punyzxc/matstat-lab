import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { RunController } from './controller.mjs';
import { ENGINE_VERSION } from './engine.mjs';
const spec = { experiment: 'clt', model: 'exponential', seed: 2048, n: 250, repetitions: 8000, retain: 64 };

test('AC2 regression: completion during a pending pause settles it with a typed terminal outcome', async () => {
  let worker;
  const controller = new RunController(() => (worker = { postMessage() {}, terminate() {}, onmessage: null, onerror: null }));
  try {
    const run = controller.start(spec);
    worker.onmessage({ data: { type: 'running', runId: run.runId, sequence: 1, engineVersion: ENGINE_VERSION } });
    const pause = controller.pause();
    worker.onmessage({ data: { type: 'completed', runId: run.runId, sequence: 2, engineVersion: ENGINE_VERSION, result: { means: new Float64Array() }, retainedBytes: 0 } });
    await assert.rejects(pause, error => error.code === 'RUN_FINISHED');
    await run.completion;
  } finally { controller.dispose(); }
});

test('AC2 regression: the message scheduler yields to a mid-run pause before completing all work', async () => {
  const factory = () => {
    const worker = new Worker(new URL('./node-worker.mjs', import.meta.url));
    return { postMessage: (...args) => worker.postMessage(...args), terminate: () => worker.terminate(), set onmessage(fn) { worker.on('message', data => fn({ data })); }, set onerror(fn) { worker.on('error', fn); } };
  };
  const controller = new RunController(factory);
  try {
    const run = controller.start(spec, { batchSize: 2048, scheduler: 'message' });
    await controller.waitFor('running');
    const deadline = performance.now() + 2000;
    while (controller.snapshot().processed === 0 && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 1));
    await controller.pause();
    assert.ok(controller.snapshot().processed > 0 && controller.snapshot().processed < 2_000_000);
    await controller.cancel();
    await assert.rejects(run.completion, /cancel/i);
  } finally { controller.dispose(); }
});
