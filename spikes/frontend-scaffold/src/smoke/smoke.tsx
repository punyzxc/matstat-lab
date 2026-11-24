import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { runAndRecord } from '../functional/adapters/run-and-record';

type State = { status: 'running' | 'done' | 'error'; mean?: number; stored?: number; detail?: string };

/** Test-only page: proves Worker progress + result and an IndexedDB round trip in a real browser. */
function Smoke() {
  const [progress, setProgress] = useState<number[]>([]);
  const [state, setState] = useState<State>({ status: 'running' });
  useEffect(() => {
    const seen: number[] = [];
    runAndRecord({ id: 'smoke-1', seed: 42, n: 10_000, batch: 2_500 }, (done) => {
      seen.push(done);
      setProgress([...seen]);
    })
      .then(({ result, stored }) =>
        setState({ status: 'done', mean: result.mean, stored: (stored?.payload as { mean: number } | undefined)?.mean }),
      )
      .catch((error: unknown) => setState({ status: 'error', detail: String(error) }));
  }, []);
  return (
    <output
      data-testid="smoke"
      data-status={state.status}
      data-progress={progress.join(',')}
      data-mean={state.mean ?? ''}
      data-stored={state.stored ?? ''}
    >
      {state.status} {state.detail ?? ''}
    </output>
  );
}

createRoot(document.getElementById('root')!).render(<Smoke />);
