/// <reference lib="webworker" />
import type { RunSpec, WorkerMessage } from './protocol';
import { runMean } from './run';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const post = (message: WorkerMessage) => scope.postMessage(message);

scope.onmessage = (event: MessageEvent<RunSpec>) => {
  const spec = event.data;
  try {
    const result = runMean(spec, (done, total) => post({ type: 'progress', id: spec.id, done, total }));
    post({ type: 'result', result });
  } catch (error) {
    post({ type: 'error', id: spec.id, message: error instanceof Error ? error.message : String(error) });
  }
};
