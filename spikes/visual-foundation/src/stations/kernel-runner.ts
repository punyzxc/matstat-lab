import { useEffect, useRef, useState } from 'react';
import type { Kernel } from './kernel-contract';
import type { RunReply, RunRequest } from './kernel-worker';

export type Job = { params: Record<string, number>; seed: number; tag?: unknown };
export type Outcome = { job: Job; ok: true; result: unknown; ms: number } | { job: Job; ok: false; error: string; ms: number };

/**
 * Runs `job` through the kernel in a worker, latest wins: while one run is in flight, newer jobs
 * replace each other and only the newest runs next. Falls back to the main thread if workers fail.
 * Returns the newest outcome and whether the newest requested job has finished.
 */
export function useKernelRunner(kernelId: string, station: string, kernel: Kernel, job: Job) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const worker = useRef<Worker | null>(null);
  const failed = useRef(false);
  const inFlight = useRef<{ id: number; job: Job } | null>(null);
  const pending = useRef<Job | null>(null);
  const seq = useRef(0);
  const [settled, setSettled] = useState<Job | null>(null);

  const runLocal = (j: Job) => {
    const t0 = performance.now();
    try {
      const result = kernel.run(j.params, { seed: j.seed, station });
      return { job: j, ok: true as const, result, ms: performance.now() - t0 };
    } catch (e) {
      return { job: j, ok: false as const, error: e instanceof Error ? e.message : String(e), ms: performance.now() - t0 };
    }
  };

  const send = useRef<(j: Job) => void>(() => {});
  send.current = (j: Job) => {
    if (!worker.current && !failed.current) {
      try {
        worker.current = new Worker(new URL('./kernel-worker.ts', import.meta.url), { type: 'module' });
        worker.current.onmessage = (e: MessageEvent<RunReply>) => {
          const flight = inFlight.current;
          if (!flight || flight.id !== e.data.id) return;
          inFlight.current = null;
          const out: Outcome = e.data.ok
            ? { job: flight.job, ok: true, result: e.data.result, ms: e.data.ms }
            : { job: flight.job, ok: false, error: e.data.error, ms: e.data.ms };
          setOutcome(out);
          const next = pending.current;
          pending.current = null;
          if (next) send.current(next);
          else setSettled(flight.job);
        };
        worker.current.onerror = () => {
          // The worker could not start (old browser, blocked module workers): run here instead.
          failed.current = true;
          worker.current?.terminate();
          worker.current = null;
          const flight = inFlight.current;
          inFlight.current = null;
          const next = pending.current ?? flight?.job;
          pending.current = null;
          if (next) send.current(next);
        };
      } catch {
        failed.current = true;
        worker.current = null;
      }
    }
    if (!worker.current) {
      // Main-thread fallback, still asynchronous so a burst of slider moves collapses into one run.
      inFlight.current = { id: ++seq.current, job: j };
      const id = seq.current;
      setTimeout(() => {
        if (inFlight.current?.id !== id) return;
        inFlight.current = null;
        const latest = pending.current ?? j;
        pending.current = null;
        setOutcome(runLocal(latest));
        setSettled(latest);
      }, 0);
      return;
    }
    const id = ++seq.current;
    inFlight.current = { id, job: j };
    worker.current.postMessage({ id, kernel: kernelId, station, params: j.params, seed: j.seed } satisfies RunRequest);
  };

  useEffect(() => {
    if (inFlight.current) pending.current = job;
    else send.current(job);
  }, [job]);

  useEffect(() => () => {
    worker.current?.terminate();
    worker.current = null;
    inFlight.current = null;
    pending.current = null;
  }, []);

  return { outcome, done: settled === job };
}
