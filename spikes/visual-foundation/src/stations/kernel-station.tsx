import { useEffect, useMemo, useState } from 'react';
import { CircleHelp, ExternalLink, Play, SlidersHorizontal } from 'lucide-react';
import { Button, Panel, PanelHeading, Slider } from '../ui';
import { isKernel, resolveParams, type Kernel, type KernelResult, type Series } from './kernel-contract';
import type { KernelStation as KernelStationInfo } from './catalog';

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
  const validSeed = /^\d{1,10}$/.test(seedText) && Number(seedText) <= 4294967295;
  const result = useMemo<KernelResult | { error: string }>(() => {
    try {
      return kernel.run(resolved, { seed, station: station.id });
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [kernel, resolved, seed, station.id]);
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
          <Button variant="primary" type="submit" disabled={!validSeed}>
            <Play size={16} aria-hidden /> {changed ? 'Run With New Parameters' : 'Run Again'}
          </Button>
        </form>
      </Panel>
      <Panel label="Station output" className="outputs">
        {'error' in result ? (
          <p className="station-status" role="alert">The kernel rejected these parameters: {result.error}</p>
        ) : (
          <>
            {result.series.length > 0 && <SeriesPlot series={result.series} />}
            <table className="readouts" aria-label="Readouts">
              <thead><tr><th scope="col">Quantity</th><th scope="col">Observed</th><th scope="col">Theory</th></tr></thead>
              <tbody>
                {result.readouts.map((r) => (
                  <tr key={r.key}>
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
                {result.notes.map((n) => <p key={n}>{n}</p>)}
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

/** A small, honest chart for any contract series: shared axes, no smoothing, each kind drawn as itself. */
export function SeriesPlot({ series }: { series: Series[] }) {
  const W = 640, H = 260, L = 44, R = 12, T = 12, B = 28;
  const xs = series.flatMap((s) => s.x).filter(Number.isFinite);
  const ys = series.flatMap((s) => [...s.y, ...(s.y2 ?? [])]).filter(Number.isFinite);
  if (!xs.length || !ys.length) return null;
  let [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  let [y0, y1] = [Math.min(0, ...ys), Math.max(...ys)];
  if (x0 === x1) [x0, x1] = [x0 - 1, x1 + 1];
  if (y0 === y1) y1 = y0 + 1;
  const sx = (x: number) => L + ((x - x0) / (x1 - x0)) * (W - L - R);
  const sy = (y: number) => H - B - ((y - y0) / (y1 - y0)) * (H - T - B);
  const step = (s: Series) => s.x.map((x, i) => `${i ? 'H' : 'M'}${sx(x)},${sy(i ? s.y[i - 1] : 0)}V${sy(s.y[i])}`).join('') + `H${W - R}`;
  const line = (s: Series) => s.x.map((x, i) => `${i ? 'L' : 'M'}${sx(x)},${sy(s.y[i])}`).join('');
  const barW = (s: Series) => (s.x.length > 1 ? Math.abs(sx(s.x[1]) - sx(s.x[0])) : 8);
  return (
    <figure className="series-plot">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={series.map((s) => s.label ?? s.id).join(', ')}>
        <path d={`M${L},${T}V${H - B}H${W - R}`} className="axis" />
        <text x={L - 6} y={sy(y1) + 4} textAnchor="end">{show(y1)}</text>
        <text x={L - 6} y={sy(y0)} textAnchor="end">{show(y0)}</text>
        <text x={L} y={H - 8}>{show(x0)}</text>
        <text x={W - R} y={H - 8} textAnchor="end">{show(x1)}</text>
        {series.map((s) => {
          const cls = `series series--${s.kind}`;
          if (s.kind === 'hist' || s.kind === 'pmf') {
            const w = s.kind === 'pmf' ? 2 : Math.max(1, barW(s) - 1);
            return <g key={s.id} className={cls}>{s.x.map((x, i) => (
              <rect key={i} x={sx(x) - (s.kind === 'pmf' ? 1 : 0)} y={sy(s.y[i])} width={w} height={Math.max(0, sy(y0) - sy(s.y[i]))} />
            ))}</g>;
          }
          if (s.kind === 'points') return <g key={s.id} className={cls}>{s.x.map((x, i) => <circle key={i} cx={sx(x)} cy={sy(s.y[i])} r={1.6} />)}</g>;
          if (s.kind === 'band' && s.y2) {
            const upper = s.x.map((x, i) => `${i ? 'L' : 'M'}${sx(x)},${sy(s.y2![i])}`).join('');
            const lower = [...s.x].reverse().map((x, i) => `L${sx(x)},${sy(s.y[s.x.length - 1 - i])}`).join('');
            return <path key={s.id} className={cls} d={`${upper}${lower}Z`} />;
          }
          return <path key={s.id} className={cls} d={s.kind === 'ecdf' || s.kind === 'cdf' && s.x.length < 60 ? step(s) : line(s)} />;
        })}
      </svg>
      <figcaption>{series.map((s) => <span key={s.id} className={`key key--${s.kind}`}><i />{s.label ?? s.id}{s.unit ? ` (${s.unit})` : ''}</span>)}</figcaption>
    </figure>
  );
}
