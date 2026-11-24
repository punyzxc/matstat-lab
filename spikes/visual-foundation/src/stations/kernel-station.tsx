import { useEffect, useMemo, useState } from 'react';
import { CircleHelp, ExternalLink, Play, SlidersHorizontal } from 'lucide-react';
import { Button, Panel, PanelHeading, Slider } from '../ui';
import { isKernel, resolveParams, type Kernel, type KernelResult } from './kernel-contract';
import type { KernelStation as KernelStationInfo } from './catalog';
import { Chart } from './chart';
import { Surface3D } from './surface-3d';

/** Every kernel spike that exists in the repository, loaded lazily: `spikes/<id>/kernel.mjs`. */
const sources = import.meta.glob('../../../*/kernel.mjs');
const keyFor = (kernel: string) => `../../../${kernel}/kernel.mjs`;
export const kernelAvailable = (kernel: string) => keyFor(kernel) in sources;

const format = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 5 });
const show = (v: number | string | null | undefined) =>
  v == null ? '—' : typeof v === 'number' ? (Number.isFinite(v) ? format.format(v) : String(v)) : v;

type Load = { state: 'loading' } | { state: 'missing' } | { state: 'error'; message: string } | { state: 'ready'; kernel: Kernel };

function useKernel(id: string): Load {
  const [load, setLoad] = useState<Load>(() => (kernelAvailable(id) ? { state: 'loading' } : { state: 'missing' }));
  useEffect(() => {
    const importer = sources[keyFor(id)];
    if (!importer) return setLoad({ state: 'missing' });
    let live = true;
    importer()
      .then((mod) => {
        if (!live) return;
        const kernel = (mod as { default?: unknown }).default ?? mod;
        setLoad(isKernel(kernel) ? { state: 'ready', kernel } : { state: 'error', message: 'The module does not export meta and run().' });
      })
      .catch((e: unknown) => live && setLoad({ state: 'error', message: String(e) }));
    return () => {
      live = false;
    };
  }, [id]);
  return load;
}

export function KernelStation({
  station,
  seed,
  params,
  onState,
}: {
  station: KernelStationInfo;
  seed: number;
  params: Record<string, number>;
  onState: (seed: number, params: Record<string, number>) => void;
}) {
  const load = useKernel(station.kernel);
  if (load.state === 'missing') return <PendingStation station={station} />;
  if (load.state === 'loading') return <p className="station-status" role="status">Loading the {station.name} kernel…</p>;
  if (load.state === 'error') return <p className="station-status" role="alert">The kernel failed to load: {load.message}</p>;
  return <ReadyStation station={station} kernel={load.kernel} seed={seed} params={params} onState={onState} />;
}

function ReadyStation({ station, kernel, seed, params, onState }: {
  station: KernelStationInfo; kernel: Kernel; seed: number; params: Record<string, number>;
  onState: (seed: number, params: Record<string, number>) => void;
}) {
  const declared = kernel.stations?.[station.id]?.params ?? kernel.meta.params;
  const resolved = useMemo(() => resolveParams(declared, params), [declared, params]);
  const [draft, setDraft] = useState(resolved);
  const [seedText, setSeedText] = useState(String(seed));
  useEffect(() => setDraft(resolved), [resolved]);
  useEffect(() => setSeedText(String(seed)), [seed]);
  const live = Boolean(kernel.stations?.[station.id]?.live);
  // Live stations run on the draft parameters, at most once per animation frame (latest wins).
  const [liveParams, setLiveParams] = useState(resolved);
  useEffect(() => {
    if (!live) return;
    const frame = requestAnimationFrame(() => setLiveParams((prev) => {
      // Keep the same object when nothing changed, so opening a station runs the kernel once.
      const next = resolveParams(declared, draft);
      return declared.every((p) => prev[p.key] === next[p.key]) ? prev : next;
    }));
    return () => cancelAnimationFrame(frame);
  }, [live, declared, draft]);
  const runParams = live ? liveParams : resolved;
  const validSeed = /^\d{1,10}$/.test(seedText) && Number(seedText) <= 4294967295;
  const result = useMemo<KernelResult | { error: string }>(() => {
    try {
      const out = kernel.run(runParams, { seed, station: station.id }) as Partial<KernelResult> | null;
      if (!out || !Array.isArray(out.readouts) || !Array.isArray(out.series))
        return { error: 'The kernel returned no readouts or series.' };
      return { readouts: out.readouts, series: out.series, notes: Array.isArray(out.notes) ? out.notes : [], axes: out.axes, surface: out.surface };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [kernel, runParams, seed, station.id]);
  const previewing = live && declared.some((p) => draft[p.key] !== resolved[p.key]);
  const changed = validSeed && (Number(seedText) !== seed || declared.some((p) => draft[p.key] !== resolved[p.key]));

  return (
    <div className="station-grid">
      <Panel label="Station parameters" className="parameters">
        <PanelHeading icon={<SlidersHorizontal size={16} aria-hidden />} title="Parameters" />
        <form
          className="parameter-body"
          onSubmit={(e) => {
            e.preventDefault();
            if (validSeed) onState(Number(seedText), draft);
          }}
        >
          {declared.map((p) => (
            <Slider key={p.key} id={`p-${p.key}`} label={p.label} value={draft[p.key]} display={show(draft[p.key])}
              min={p.min} max={p.max} step={p.step} onChange={(v) => setDraft({ ...draft, [p.key]: v })} />
          ))}
          <div className="seed-field">
            <label htmlFor="station-seed">Random seed</label>
            <input id="station-seed" name="seed" inputMode="numeric" autoComplete="off" spellCheck={false} value={seedText}
              aria-invalid={!validSeed} aria-describedby={validSeed ? undefined : 'station-seed-error'}
              onChange={(e) => setSeedText(e.currentTarget.value)} />
            {!validSeed && <small id="station-seed-error">Enter an integer from 0 to 4,294,967,295.</small>}
          </div>
          <Button variant="primary" type="submit" disabled={!changed}>
            <Play size={16} aria-hidden /> {changed ? 'Run With These Parameters' : 'Result Is Up to Date'}
          </Button>
        </form>
      </Panel>
      <Panel label="Station output" className="outputs">
        {'error' in result ? (
          <p className="station-status" role="alert">The kernel rejected these parameters: {result.error}</p>
        ) : (
          <>
            {result.surface && <Surface3D surface={result.surface} />}
            {result.series.length > 0 && <Chart series={result.series} xLabel={result.axes?.x} yLabel={result.axes?.y} />}
            {previewing && <p className="live-note">Live preview — press Run to record these parameters in the link.</p>}
            <table className="readouts" aria-label="Readouts">
              <thead><tr><th scope="col">Quantity</th><th scope="col">Observed</th><th scope="col">Theory</th></tr></thead>
              <tbody>
                {result.readouts.map((r, i) => (
                  <tr key={r.key + i}>
                    <th scope="row">{r.label}{r.convention && <small>{r.convention}</small>}</th>
                    <td>{show(r.observed)}{r.unit && r.observed != null ? ` ${r.unit}` : ''}</td>
                    <td>{show(r.theory)}{r.unit && r.theory != null ? ` ${r.unit}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.notes.length > 0 && (
              <div className="station-notes">
                <PanelHeading icon={<CircleHelp size={16} aria-hidden />} title="Reading the result" />
                {result.notes.map((n, i) => <p key={i}>{n}</p>)}
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}

/** A station whose kernel has not landed yet: says what it will show and where the work is tracked. */
export function PendingStation({ station }: { station: KernelStationInfo }) {
  return (
    <div className="station-pending">
      <p className="edition"><i /> KERNEL IN PROGRESS</p>
      <p>{station.summary}</p>
      <p>
        The station appears here as soon as <code translate="no">spikes/{station.kernel}/kernel.mjs</code> lands.
      </p>
      <a href={`https://github.com/punyzxc/matstat-lab/issues/${station.issue}`} target="_blank" rel="noreferrer">
        Track issue #{station.issue} <ExternalLink size={13} aria-hidden />
      </a>
    </div>
  );
}

