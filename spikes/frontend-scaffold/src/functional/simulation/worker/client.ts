// Vite's `?worker` import, not `new Worker(new URL(...))`: @vitest/web-worker 5.1.1 cannot resolve the URL form
// when the checkout path has non-ASCII characters (the owner's Windows profile does). Both forms build the same ES worker.
import MeanWorker from './mean.worker.ts?worker';
import type { RunResult, RunSpec, WorkerMessage } from './protocol';

/** Runs one spec in a fresh module Worker; resolves with the result and reports each progress message. */
export function runInWorker(spec: RunSpec, onProgress?: (done: number, total: number) => void): Promise<RunResult> {
  const worker = new MeanWorker();
  return new Promise((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === 'progress') {
        onProgress?.(message.done, message.total);
        return;
      }
      worker.terminate();
      if (message.type === 'result') resolve(message.result);
      else reject(new Error(message.message));
    };
    const fail = (error: Error) => {
      worker.terminate();
      reject(error);
    };
    worker.onerror = (event) => fail(new Error(event.message || 'worker failed'));
    worker.onmessageerror = () => fail(new Error('worker message could not be deserialized'));
    try {
      worker.postMessage(spec);
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
