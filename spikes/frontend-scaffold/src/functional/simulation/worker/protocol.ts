/** Messages between the UI thread and the simulation Worker. */
export type RunSpec = { id: string; seed: number; n: number; batch: number };
export type RunResult = { id: string; seed: number; n: number; mean: number };
export type WorkerMessage =
  | { type: 'progress'; id: string; done: number; total: number }
  | { type: 'result'; result: RunResult }
  | { type: 'error'; id: string; message: string };
