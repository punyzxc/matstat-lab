// Browser-compatible fixture bridge. Node is evidence, not a substitute for browser checks.
import { parentPort } from 'node:worker_threads';
globalThis.postMessage = (message, transfers) => parentPort.postMessage(message, transfers);
const queued = [];
parentPort.on('message', data => {
  if (globalThis.onmessage) globalThis.onmessage({ data });
  else queued.push(data);
});
await import('./worker.mjs');
for (const data of queued) globalThis.onmessage({ data });
