import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Box, CircleHelp, ExternalLink, SlidersHorizontal } from 'lucide-react';
import { Panel, PanelHeading, Slider } from '../ui';
import { isKernel, resolveParams, type Kernel, type KernelParam, type KernelResult, type Series } from './kernel-contract';
import { AutoplayBar, useAutoplayKeys, usePlayback, useTicker } from './autoplay';
import { choicesOf, grownSize, GROWTH, ridgeOf, sizeParamOf, tickDelay, traceSummary } from './autoplay-math.mjs';
import { useKernelRunner, type Job } from './kernel-runner';
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

/** Parameters as a stable string, to tell a new experiment from a new draw of the same one. */
const keyOf = (declared: KernelParam[], p: Record<string, number>) => declared.map((d) => `${d.key}=${p[d.key]}`).join('&');
const numeric = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const TRACE = 60, RIDGE = 18;

type Draw = { draw: number; seed: number; result: KernelResult };

function ReadyStation({ station, kernel, seed: seedProp, params: paramsProp, onState }: {
  station: KernelStationInfo; kernel: Kernel; seed: number; params: Record<string, number>;
  onState: (seed: number, params: Record<string, number>) => void;
}) {
  const declared = kernel.stations?.[station.id]?.params ?? kernel.meta.params;
  const size = useMemo(() => sizeParamOf(declared), [declared]);
  const resolved = useMemo(() => resolveParams(declared, paramsProp), [declared, paramsProp]);
  const [params, setParams] = useState(resolved);
  const [seed, setSeed] = useState(seedProp);
  // A link opened from outside (a lecture step, the address bar) replaces the experiment.
  useEffect(() => setParams(resolved), [resolved]);
  useEffect(() => setSeed(seedProp), [seedProp]);
  const playback = usePlayback();
  const { playing, setPlaying, speed } = playback;
  // Growth: a fresh experiment starts small and grows to the chosen size, frame by frame.
  const [grow, setGrow] = useState(() => (playing && size ? 0 : GROWTH.length));
  const growing = Boolean(size) && grow < GROWTH.length;
  const [draws, setDraws] = useState(0);

  const job = useMemo<Job>(() => {
    const p = growing && size ? { ...params, [size.key]: grownSize(size, params[size.key], grow) } : params;
    return { params: p, seed, tag: growing ? 'grow' : 'draw' };
  }, [params, seed, grow, growing, size]);
  const { outcome, done } = useKernelRunner(station.kernel, station.id, kernel, job);

  const result = useMemo<KernelResult | { error: string } | null>(() => {
    if (!outcome) return null;
    if (!outcome.ok) return { error: outcome.error };
    const out = outcome.result as Partial<KernelResult> | null;
    if (!out || !Array.isArray(out.readouts) || !Array.isArray(out.series)) return { error: 'The kernel returned no readouts or series.' };
    return { readouts: out.readouts, series: out.series, notes: Array.isArray(out.notes) ? out.notes : [], axes: out.axes, surface: out.surface };
  }, [outcome]);
  const failed = Boolean(result && 'error' in result);

  // The URL always reproduces what is on screen (replaceState: no history entry per draw).
  const sync = useRef(onState);
  sync.current = onState;
  useEffect(() => {
    const t = window.setTimeout(() => sync.current(seed, params), playing ? 900 : 250);
    return () => clearTimeout(t);
  }, [seed, params, playing]);

  const advance = useCallback(() => {
    if (growing) setGrow((k) => k + 1);
    else {
      setSeed((s) => (s + 1) >>> 0);
      setDraws((d) => d + 1);
    }
  }, [growing]);
  const step = useCallback(() => {
    setPlaying(false);
    setGrow(GROWTH.length);
    setSeed((s) => (s + 1) >>> 0);
    setDraws((d) => d + 1);
  }, [setPlaying]);
  const restart = useCallback(() => {
    setSeed((s) => (s + 1) >>> 0);
    setGrow(size ? 0 : GROWTH.length);
    setPlaying(true);
  }, [size, setPlaying]);
  useAutoplayKeys(() => setPlaying((p) => !p), step);
  useTicker(playing && done && !failed, tickDelay(speed, outcome?.ms ?? 0, growing), job, advance);

  // History of draws of this exact experiment: the trace of one readout and the 3D ridge.
  const expKey = keyOf(declared, params);
  const lastExp = useRef(expKey);
  useEffect(() => {
    if (lastExp.current !== expKey) setDraws(0);
    lastExp.current = expKey;
  }, [expKey]);
  const [history, setHistory] = useState<{ key: string; draws: Draw[] }>({ key: expKey, draws: [] });
  useEffect(() => {
    if (!outcome?.ok || !result || 'error' in result || outcome.job.tag === 'grow') return;
    const k = keyOf(declared, outcome.job.params);
    setHistory((h) => {
      const base = h.key === k ? h.draws : [];
      if (base.at(-1)?.seed === outcome.job.seed) return h.key === k ? h : { key: k, draws: base };
      return { key: k, draws: [...base, { draw: (base.at(-1)?.draw ?? 0) + 1, seed: outcome.job.seed, result }].slice(-TRACE) };
    });
  }, [outcome, result, declared]);
  const past = history.key === expKey ? history.draws : [];

  const [tracked, setTracked] = useState<string | null>(null);
  const [ridgeOn, setRidgeOn] = useState(false);
  const shown = result && !('error' in result) ? result : null;
  const trackable = shown?.readouts.filter((r) => numeric(r.observed)) ?? [];
  const trackKey = tracked && trackable.some((r) => r.key === tracked) ? tracked
    : (trackable.find((r) => numeric(r.theory)) ?? trackable[0])?.key ?? null;

  const status = failed ? 'Stopped: the kernel rejected these parameters'
    : growing && size ? `Growing the sample · ${size.label.replace(/\s*\(.*\)$/, '')} ${fmtInt(job.params[size.key])} of ${fmtInt(params[size.key])}`
    : `${playing ? 'Live' : 'Stopped'} · draw ${draws + 1} · seed ${seed}`;

  return (
    <div className="station-grid">
      <Panel label="Station parameters" className="parameters">
        <PanelHeading icon={<SlidersHorizontal size={16} aria-hidden />} title="Parameters" />
        <div className="parameter-body">
          {declared.map((p) => {
            const choice = choicesOf(p);
            return choice ? (
              <Choice key={p.key} id={`p-${p.key}`} title={choice.title} options={choice.options} value={params[p.key]}
                onChange={(v) => setParams({ ...params, [p.key]: v })} />
            ) : (
              <Slider key={p.key} id={`p-${p.key}`} label={p.label} value={params[p.key]} display={show(params[p.key])}
                min={p.min} max={p.max} step={p.step} onChange={(v) => setParams({ ...params, [p.key]: v })} />
            );
          })}
          <SeedField seed={seed} onSeed={(v) => { setSeed(v); setDraws(0); }} />
          <p className="parameter-hint">Every change runs at once. Type exact values in the boxes: 0,5 · 20 000 · 1/3 · π/4.</p>
        </div>
      </Panel>
      <Panel label="Station output" className="outputs">
        <AutoplayBar playback={playback} onStep={step} onRestart={size ? restart : undefined} status={status}
          progress={growing ? (grow + 1) / GROWTH.length : null} />
        {!result ? (
          <p className="station-status" role="status">Running the first experiment…</p>
        ) : 'error' in result ? (
          <p className="station-status" role="alert">The kernel rejected these parameters: {result.error}</p>
        ) : (
          <>
            {result.surface && <Surface3D surface={result.surface} />}
            {result.series.length > 0 && (
              <div className="chart-stage">
                <Chart series={result.series} xLabel={result.axes?.x} yLabel={result.axes?.y} />
                <RidgeToggle draws={past} on={ridgeOn} onToggle={() => setRidgeOn((v) => !v)} />
              </div>
            )}
            {ridgeOn && <Ridge draws={past} axes={result.axes} />}
            <table className="readouts" aria-label="Readouts">
              <thead><tr><th scope="col">Quantity</th><th scope="col">Observed</th><th scope="col">Theory</th><th scope="col"><span className="sr-only">Track</span></th></tr></thead>
              <tbody>
                {result.readouts.map((r, i) => (
                  <tr key={r.key + i} data-tracked={r.key === trackKey || undefined}>
                    <th scope="row">{r.label}{r.convention && <small>{r.convention}</small>}</th>
                    <td>{show(r.observed)}{r.unit && r.observed != null ? ` ${r.unit}` : ''}</td>
                    <td>{show(r.theory)}{r.unit && r.theory != null ? ` ${r.unit}` : ''}</td>
                    <td className="readout-track">
                      {numeric(r.observed) && (
                        <button type="button" aria-pressed={r.key === trackKey} aria-label={`Follow ${r.label} across draws`}
                          title="Follow this quantity across draws" onClick={() => setTracked(r.key)}><Activity size={13} aria-hidden /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {trackKey && <Trace draws={past} readoutKey={trackKey} />}
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

const fmtInt = (v: number) => Math.round(v).toLocaleString('en-US').replace(/,/g, ' ');

/** The seed field applies a valid seed as soon as it is typed; it follows the draws while playing. */
function SeedField({ seed, onSeed }: { seed: number; onSeed: (seed: number) => void }) {
  const [text, setText] = useState<string | null>(null);
  const value = text ?? String(seed);
  const valid = /^\d{1,10}$/.test(value) && Number(value) <= 4294967295;
  return (
    <div className="seed-field">
      <label htmlFor="station-seed">Random seed</label>
      <input id="station-seed" name="seed" inputMode="numeric" autoComplete="off" spellCheck={false} value={value}
        aria-invalid={!valid} aria-describedby={valid ? undefined : 'station-seed-error'}
        onFocus={() => setText(String(seed))}
        onBlur={() => setText(null)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        onChange={(e) => {
          const v = e.currentTarget.value.trim();
          setText(v);
          if (/^\d{1,10}$/.test(v) && Number(v) <= 4294967295) onSeed(Number(v));
        }} />
      {!valid && <small id="station-seed-error">Enter an integer from 0 to 4,294,967,295.</small>}
    </div>
  );
}

/** A parameter with named values ("Law: normal · uniform · …") as a row of chips; arrow keys move. */
function Choice({ id, title, options, value, onChange }: {
  id: string; title: string; options: { value: number; label: string }[]; value: number; onChange: (v: number) => void;
}) {
  const at = options.findIndex((o) => o.value === value);
  return (
    <div className="choice-field">
      <span className="choice-title" id={`${id}-title`}>{title}</span>
      <div className="choice-chips" role="radiogroup" aria-labelledby={`${id}-title`}>
        {options.map((o, i) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value} tabIndex={i === Math.max(0, at) ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
              const digit = /^[0-9]$/.test(e.key) ? options.find((q) => q.value === Number(e.key)) : undefined;
              if (!d && !digit) return;
              e.preventDefault();
              const next = digit ?? options[(Math.max(0, at) + d + options.length) % options.length];
              onChange(next.value);
              (e.currentTarget.parentElement?.children[options.indexOf(next)] as HTMLElement | undefined)?.focus();
            }}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** One readout followed across draws: each dot is one experiment, the line their running mean. */
function Trace({ draws, readoutKey }: { draws: Draw[]; readoutKey: string }) {
  const rows = draws.map((d) => ({ draw: d.draw, r: d.result.readouts.find((r) => r.key === readoutKey) }));
  const values = rows.map((x) => (numeric(x.r?.observed) ? x.r.observed : NaN));
  const label = rows.at(-1)?.r?.label ?? readoutKey;
  const theory = rows.at(-1)?.r?.theory;
  const sum = traceSummary(values, numeric(theory) ? theory : null);
  const series = useMemo<Series[]>(() => {
    const x = rows.map((r) => r.draw);
    let acc = 0, n = 0;
    const mean = values.map((v) => (Number.isFinite(v) ? ((acc += v), ++n, acc / n) : n ? acc / n : NaN));
    const out: Series[] = [{ id: 'draws', kind: 'points', x, y: values, label: 'one draw' }];
    if (x.length > 1) out.push({ id: 'mean', kind: 'line', x, y: mean, label: 'mean of the draws' });
    if (numeric(theory) && x.length) out.push({ id: 'theory', kind: 'line', x: [x[0], x[x.length - 1] + 0.001], y: [theory, theory], tone: 'signal', label: 'theory' });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draws, readoutKey]);
  return (
    <section className="trace" aria-label={`${label} across draws`}>
      <p className="trace-head">
        <b>Across draws</b> · {label}
        {sum.count > 0 && <span> · mean {show(sum.mean)}{sum.sd != null && <> ± {show(sum.sd)}</>} over {sum.count} draw{sum.count === 1 ? '' : 's'}{sum.theory != null && <> · theory {show(sum.theory)}</>}</span>}
      </p>
      {draws.length < 2 ? (
        <p className="trace-empty">Each new draw adds a dot here. {draws.length ? 'One so far.' : ''}</p>
      ) : (
        <Chart series={series} xLabel="draw" height={150} domain={{ y: traceDomain(values, sum.theory) }} />
      )}
    </section>
  );
}

/** A y range around the draws (and theory), so the scatter of the draws is visible rather than flattened against zero. */
function traceDomain(values: number[], theory: number | null | undefined): [number, number] {
  const all = [...values.filter(Number.isFinite), ...(theory != null ? [theory] : [])];
  if (!all.length) return [0, 1];
  let lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo) * 0.25 || Math.abs(hi) * 0.05 || 0.5;
  lo -= pad;
  hi += pad;
  return [lo, hi];
}

/** The main curve of each draw. Histograms first, then densities, then any long line. */
function mainCurve(r: KernelResult) {
  const pick = r.series.find((s) => s.kind === 'hist') ?? r.series.find((s) => (s.kind === 'ecdf' || s.kind === 'line') && (s.tone ?? 'default') === 'default' && s.x.length >= 10);
  return pick && pick.x.length > 2 ? pick : null;
}
function ridgeRows(draws: Draw[]) {
  return draws.slice(-RIDGE).flatMap((d) => {
    const c = mainCurve(d.result);
    return c ? [{ draw: d.draw, x: c.x, y: c.y }] : [];
  });
}
function RidgeToggle({ draws, on, onToggle }: { draws: Draw[]; on: boolean; onToggle: () => void }) {
  const last = draws.at(-1);
  if (!last || !mainCurve(last.result)) return null;
  return (
    <button type="button" className="ridge-toggle" aria-pressed={on} onClick={onToggle} title="Stack the last draws into a rotatable 3D landscape">
      <Box size={13} aria-hidden /> 3D draws
    </button>
  );
}
function Ridge({ draws, axes }: { draws: Draw[]; axes?: KernelResult['axes'] }) {
  const surface = useMemo(() => ridgeOf(ridgeRows(draws), { x: axes?.x ?? 'x', y: 'draw', z: axes?.y ?? 'height' }), [draws, axes]);
  if (!surface) return <p className="trace-empty">The 3D view appears after three draws. {draws.length ? `${draws.length} so far.` : ''}</p>;
  return <Surface3D surface={surface} keyLabel={`Each ridge: one draw's ${axes?.y ?? 'curve'}`} />;
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

