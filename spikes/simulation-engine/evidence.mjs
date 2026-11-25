import { RunController } from './controller.mjs';
import { createEngine, advance, finish, canonical, ENGINE_VERSION, RNG_VERSION, THEORY } from './engine.mjs';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const version = { engineVersion: ENGINE_VERSION, rngVersion: RNG_VERSION };
const small = { ...version, experiment: 'clt', model: 'exponential', seed: 2048, n: 17, repetitions: 31, retain: 31 };
const pure = spec => { const state = createEngine(spec); while (!state.done) advance(state, 2048); return finish(state); };
const plain = result => JSON.parse(canonical(result));
async function sha(result) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(result)));
  return Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
}

export async function collectEvidence(factory) {
  const replay = [];
  const cases = [
    [small, 1, 'timeout'], [small, 7, 'message'], [small, 2048, 'timeout'],
    [{ ...small, experiment: 'lln', model: 'uniform', seed: 0, n: 257, repetitions: 1 }, 7, 'message'],
    [{ ...small, experiment: 'lln', model: 'uniform', seed: 0, n: 257, repetitions: 1 }, 64, 'timeout'],
    [{ ...small, seed: 0xffffffff, n: 11, repetitions: 17 }, 17, 'timeout'],
    [{ ...small, seed: 0xffffffff, n: 11, repetitions: 17 }, 2048, 'message'],
  ];
  for (const [spec, batchSize, scheduler] of cases) {
    const controller = new RunController(factory);
    try {
      const result = await controller.start(spec, { batchSize, scheduler }).completion;
      assert(canonical(result) === canonical(pure(spec)), 'Worker replay changed a scientific value');
      replay.push({ spec, batchSize, scheduler, exact: true, sha256: await sha(result), result: plain(result) });
    } finally { controller.dispose(); }
  }

  const lifecycle = [];
  for (let trial = 0; trial < 8; trial++) {
    const controller = new RunController(factory);
    try {
      const batchSize = [1, 64, 256, 2048][trial % 4], scheduler = trial % 2 ? 'message' : 'timeout';
      const began = performance.now();
      const run = controller.start({ ...small, n: 250, repetitions: 8000, retain: 64 }, { batchSize, scheduler });
      await controller.waitFor('running');
      const startupMs = performance.now() - began;
      const progressDeadline = performance.now() + 2000;
      while (controller.snapshot().processed === 0 && performance.now() < progressDeadline) await sleep(1);
      assert(controller.snapshot().processed > 0 && controller.snapshot().state === 'running', 'Lifecycle trial must pause an active nonempty run');
      const pauseAt = performance.now(); await controller.pause(); const pauseMs = performance.now() - pauseAt;
      const paused = controller.snapshot();
      await sleep(20);
      assert(controller.snapshot().processed === paused.processed, 'Paused Worker progressed');
      const resumeAt = performance.now(); await controller.resume(); const resumeMs = performance.now() - resumeAt;
      const old = controller.snapshot();
      const cancellation = await controller.cancel();
      try { await run.completion; throw new Error('Cancelled run completed'); } catch (error) { assert(/cancel/i.test(error.message), 'Cancellation was not observable'); }
      assert(cancellation.acknowledged && cancellation.terminated && cancellation.workerRetainedBytes === 0, 'Cancel did not acknowledge release and termination');
      const restartAt = performance.now(); const replacement = controller.start(small, { batchSize: 2048, scheduler: 'message' });
      await controller.waitFor('running'); const restartStartupMs = performance.now() - restartAt;
      const replacementResult = await replacement.completion;
      assert(canonical(replacementResult) === canonical(pure(small)), 'Replacement result changed');
      const committed = controller.committed;
      controller.accept({ type: 'completed', runId: run.runId, sequence: 99999, engineVersion: ENGINE_VERSION, result: replacementResult }, old.epoch);
      controller.accept({ type: 'progress', runId: replacement.runId, sequence: 0, engineVersion: ENGINE_VERSION, processed: -1 }, controller.epoch);
      assert(controller.committed === committed && controller.snapshot().rejectedEvents >= 2, 'Late event replaced committed state');
      assert(controller.snapshot().terminationErrors.length === 0, 'Worker termination reported an error');
      const final = controller.snapshot(); controller.dispose();
      assert(controller.snapshot().committedNumericBytes === 0, 'Disposed controller retained its scientific buffers');
      lifecycle.push({ trial, batchSize, scheduler, startupMs, pauseMs, resumeMs, cancel: cancellation, restartStartupMs, retainedWorkerBytesWhilePaused: paused.workerRetainedBytes, committedNumericBytesAfterReplacement: final.committedNumericBytes, rejectedInjectedEvents: 2, transitions: final.history, disposedNumericBytes: controller.snapshot().committedNumericBytes });
    } finally { controller.dispose(); }
  }

  const convergence = [];
  for (const model of ['uniform', 'exponential']) {
    for (const experiment of ['lln', 'clt']) {
      const spec = { ...version, experiment, model, seed: 2048, n: experiment === 'lln' ? 65536 : 32, repetitions: experiment === 'lln' ? 1 : 4096, retain: 256 };
      const controller = new RunController(factory);
      try {
        const result = await controller.start(spec, { batchSize: 2048, scheduler: 'message' }).completion;
        assert(canonical(result) === canonical(pure(spec)), 'Convergence output failed replay');
        const total = spec.n * spec.repetitions;
        const meanSE = Math.sqrt(THEORY[model].variance / total);
        const meanDeviationSE = Math.abs(result.mean - THEORY[model].mean) / meanSE;
        assert(meanDeviationSE <= 6, 'Fixed fixture exceeded its predeclared six-SE diagnostic band');
        convergence.push({ spec, result: plain(result), sha256: await sha(result), diagnostic: { meanSE, meanDeviationSE, predeclaredBandSE: 6, interpretation: 'Conditional iid-model diagnostic for this fixed pseudo-random fixture, not an RNG independence test or a proof of a limit theorem' } });
      } finally { controller.dispose(); }
    }
  }
  return { engineVersion: ENGINE_VERSION, rngVersion: RNG_VERSION, replay, lifecycle, convergence };
}
