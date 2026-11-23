import { Worker } from 'node:worker_threads';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { collectEvidence } from './evidence.mjs';

function factory() {
  const worker = new Worker(new URL('./node-worker.mjs', import.meta.url));
  return {
    postMessage: (...args) => worker.postMessage(...args), terminate: () => worker.terminate(),
    set onmessage(callback) { worker.on('message', data => callback({ data })); },
    set onerror(callback) { worker.on('error', callback); },
  };
}
const output = new URL('../../docs/research/assets/simulation-engine/', import.meta.url);
await mkdir(output, { recursive: true });
const hardware = process.env.EVIDENCE_HARDWARE ? JSON.parse(await readFile(process.env.EVIDENCE_HARDWARE, 'utf8')) : { status: 'not supplied; record hardware before interpreting latency' };
const evidence = { capturedAt: new Date().toISOString(), runtime: process.version, platform: process.platform, hardware, ...(await collectEvidence(factory)) };
await writeFile(new URL('node-evidence.json', output), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ runtime: evidence.runtime, replayCases: evidence.replay.length, lifecycleTrials: evidence.lifecycle.length, convergence: evidence.convergence.map(x => ({ experiment: x.spec.experiment, model: x.spec.model, mean: x.result.mean, deviationSE: x.diagnostic.meanDeviationSE })) }));
