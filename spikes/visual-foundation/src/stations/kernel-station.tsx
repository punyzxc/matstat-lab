import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Box, CircleHelp, ExternalLink, SlidersHorizontal } from 'lucide-react';
import { Panel, PanelHeading, Slider } from '../ui';
import { applies, isKernel, resolveParams, resolveTexts, type Kernel, type KernelParam, type KernelResult, type Series } from './kernel-contract';
import { AutoplayBar, useAutoplayKeys, usePlayback, useTicker } from './autoplay';
import { choicesOf, grownSize, GROWTH, ridgeOf, sizeParamOf, tickDelay, traceSummary } from './autoplay-math.mjs';
import { useKernelRunner, type Job } from './kernel-runner';
import type { KernelStation as KernelStationInfo } from './catalog';
import { Chart } from './chart';
import { Surface3D } from './surface-3d';
import { MathText, Tex, mathToPlain } from '../math';
import { DecisionZones } from './decision-zones';
import { Beam } from './beam';
import { OutcomeFlight } from './outcome-flight';
import { OutcomeSpace } from './outcome-space';
import { Constructions } from './constructions';
import { Board } from './board';
import { EventSquare } from './event-square';
import { BayesTree } from './bayes-tree';
import { TextField } from './text-field';
import { kernelText, locale, plural, t, texDec, useLang } from '../i18n';

/** Every kernel spike that exists in the repository, loaded lazily: `spikes/<id>/kernel.mjs`. */
const sources = import.meta.glob('../../../*/kernel.mjs');
const keyFor = (kernel: string) => `../../../${kernel}/kernel.mjs`;
export const kernelAvailable = (kernel: string) => keyFor(kernel) in sources;

const formats = new Map<string, Intl.NumberFormat>();
const format = (v: number) => {
  let f = formats.get(locale());
  if (!f) formats.set(locale(), (f = new Intl.NumberFormat(locale(), { maximumSignificantDigits: 5 })));
  return f.format(v).replace(/\u00a0/g, '\u2009');
};
const show = (v: number | string | null | undefined) =>
  v == null ? '—' : typeof v === 'number' ? (Number.isFinite(v) ? format(v) : String(v)) : v;

/** A kernel's output with every text in the current language (numbers stay numbers). */
function localizeResult(kernel: string, r: KernelResult): KernelResult {
  const k = <T extends string | undefined>(s: T) => kernelText(kernel, s) as T;
  const v = (x: number | string | null | undefined) => (typeof x === 'string' ? k(x) : x);
  return {
    readouts: r.readouts.map((x) => ({ ...x, label: k(x.label), convention: k(x.convention), unit: k(x.unit), observed: v(x.observed), theory: v(x.theory) })),
    series: r.series.map((s) => (s.label ? { ...s, label: k(s.label) } : s)),
    notes: r.notes.map((n) => k(n)),
    axes: r.axes && { x: k(r.axes.x), y: k(r.axes.y) },
    surface: r.surface && { ...r.surface, title: k(r.surface.title), sampleLabel: k(r.surface.sampleLabel), labels: { x: k(r.surface.labels.x), y: k(r.surface.labels.y), z: k(r.surface.labels.z) } },
    formula: r.formula?.map((line) => texDec(k(line))),
    decisions: r.decisions,
    beam: r.beam,
    domain: r.domain,
    outcomes: r.outcomes,
    space: r.space,
    constructions: r.constructions,
    board: r.board,
    square: r.square,
    tree: r.tree,
    linked: r.linked && { ...r.linked, series: r.linked.series.map((s) => (s.label ? { ...s, label: k(s.label) } : s)), axes: r.linked.axes && { x: k(r.linked.axes.x), y: k(r.linked.axes.y) } },
  };
}
/** A readout cell: numbers formatted, text with `$…$` formulas typeset. */
const cell = (v: number | string | null | undefined) => <MathText text={show(v)} />;

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
  texts = NO_TEXTS,
  onState,
}: {
  station: KernelStationInfo;
  seed: number;
  params: Record<string, number>;
  texts?: Record<string, string>;
  onState: (seed: number, params: Record<string, number>, texts: Record<string, string>) => void;
}) {
  const load = useKernel(station.kernel);
  if (load.state === 'missing') return <PendingStation station={station} />;
  if (load.state === 'loading') return <p className="station-status" role="status">{t(`Loading the ${station.name} kernel…`, `Загрузка ядра станции «${station.name}»…`)}</p>;
  if (load.state === 'error') return <p className="station-status" role="alert">{t('The kernel failed to load: ', 'Ядро не загрузилось: ')}{load.message}</p>;
  return <ReadyStation station={station} kernel={load.kernel} seed={seed} params={params} texts={texts} onState={onState} />;
}

/** Parameters as a stable string, to tell a new experiment from a new draw of the same one. */
const NO_TEXTS: Record<string, string> = {};
const keyOf = (declared: KernelParam[], p: Record<string, number>, texts: Record<string, string> = NO_TEXTS) =>
  [...declared.map((d) => `${d.key}=${p[d.key]}`), ...Object.entries(texts).map(([k, v]) => `${k}=${v}`)].join('&');
const numeric = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const TRACE = 60, RIDGE = 18;

type Draw = { draw: number; seed: number; result: KernelResult };

function ReadyStation({ station, kernel, seed: seedProp, params: paramsProp, texts: textsProp, onState }: {
  station: KernelStationInfo; kernel: Kernel; seed: number; params: Record<string, number>; texts: Record<string, string>;
  onState: (seed: number, params: Record<string, number>, texts: Record<string, string>) => void;
}) {
  const lang = useLang();
  const declared = kernel.stations?.[station.id]?.params ?? kernel.meta.params;
  /** Parameter labels in the current language, for display only (keys and ranges are the kernel's). */
  const labelled = useMemo(() => declared.map((p) => ({ ...p, label: kernelText(station.kernel, p.label) })), [declared, station.kernel, lang]);
  const size = useMemo(() => sizeParamOf(declared), [declared]);
  const resolved = useMemo(() => resolveParams(declared, paramsProp), [declared, paramsProp]);
  const [params, setParams] = useState(resolved);
  const [seed, setSeed] = useState(seedProp);
  // A link opened from outside (a lecture step, the address bar) replaces the experiment.
  useEffect(() => setParams(resolved), [resolved]);
  useEffect(() => setSeed(seedProp), [seedProp]);
  // Typed text parameters (#90): only a text the kernel accepts reaches `texts`; the field keeps the draft.
  const declaredTexts = useMemo(() => kernel.stations?.[station.id]?.texts ?? [], [kernel, station.id]);
  const resolvedTexts = useMemo(() => resolveTexts(kernel, station.id, declaredTexts, textsProp), [kernel, station.id, declaredTexts, textsProp]);
  const [texts, setTexts] = useState(resolvedTexts);
  useEffect(() => setTexts(resolvedTexts), [resolvedTexts]);
  const playback = usePlayback();
  const { playing, setPlaying, speed } = playback;
  // Growth: a fresh experiment starts small and grows to the chosen size, frame by frame.
  const [grow, setGrow] = useState(() => (playing && size ? 0 : GROWTH.length));
  const growing = Boolean(size) && grow < GROWTH.length;
  const [draws, setDraws] = useState(0);

  const job = useMemo<Job>(() => {
    const p = growing && size ? { ...params, [size.key]: grownSize(size, params[size.key], grow) } : params;
    return { params: p, seed, tag: growing ? 'grow' : 'draw', texts };
  }, [params, seed, grow, growing, size, texts]);
  const { outcome, done } = useKernelRunner(station.kernel, station.id, kernel, job);

  const result = useMemo<KernelResult | { error: string } | null>(() => {
    if (!outcome) return null;
    if (!outcome.ok) return { error: outcome.error };
    const out = outcome.result as Partial<KernelResult> | null;
    if (!out || !Array.isArray(out.readouts) || !Array.isArray(out.series)) return { error: t('The kernel returned no readouts or series.', 'Ядро не вернуло ни показаний, ни графиков.') };
    return { readouts: out.readouts, series: out.series, notes: Array.isArray(out.notes) ? out.notes : [], axes: out.axes, surface: out.surface,
      formula: Array.isArray(out.formula) ? out.formula.filter((l) => typeof l === 'string') : undefined, decisions: out.decisions, beam: out.beam,
      domain: out.domain, linked: out.linked && Array.isArray(out.linked.series) ? out.linked : undefined, outcomes: out.outcomes, space: out.space, constructions: out.constructions, board: out.board, square: out.square, tree: out.tree };
  }, [outcome]);
  /** What is on screen: the same result with its texts in the current language. */
  const view = useMemo(() => (result && !('error' in result) ? localizeResult(station.kernel, result) : result), [result, station.kernel, lang]);
  const failed = Boolean(result && 'error' in result);

  // The URL always reproduces what is on screen (replaceState: no history entry per draw).
  const sync = useRef(onState);
  sync.current = onState;
  useEffect(() => {
    const t = window.setTimeout(() => sync.current(seed, params, texts), playing ? 900 : 250);
    return () => clearTimeout(t);
  }, [seed, params, texts, playing]);

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
  const expKey = keyOf(declared, params, texts);
  const lastExp = useRef(expKey);
  useEffect(() => {
    if (lastExp.current !== expKey) setDraws(0);
    lastExp.current = expKey;
  }, [expKey]);
  const [history, setHistory] = useState<{ key: string; draws: Draw[] }>({ key: expKey, draws: [] });
  useEffect(() => {
    if (!outcome?.ok || !result || 'error' in result || outcome.job.tag === 'grow') return;
    const k = keyOf(declared, outcome.job.params, outcome.job.texts);
    setHistory((h) => {
      const base = h.key === k ? h.draws : [];
      if (base.at(-1)?.seed === outcome.job.seed) return h.key === k ? h : { key: k, draws: base };
      return { key: k, draws: [...base, { draw: (base.at(-1)?.draw ?? 0) + 1, seed: outcome.job.seed, result }].slice(-TRACE) };
    });
  }, [outcome, result, declared]);
  const past = history.key === expKey ? history.draws : [];

  const [tracked, setTracked] = useState<string | null>(null);
  /** A line of the live formula lit by the picture (#124: hovering a circle lights its method's formula). */
  const [lineFocus, setLineFocus] = useState<number | null>(null);
  const [ridgeOn, setRidgeOn] = useState(false);
  const shown = result && !('error' in result) ? result : null;
  const trackable = shown?.readouts.filter((r) => numeric(r.observed)) ?? [];
  const trackKey = tracked && trackable.some((r) => r.key === tracked) ? tracked
    : (trackable.find((r) => numeric(r.theory)) ?? trackable[0])?.key ?? null;

  const sizeName = size ? mathToPlain(kernelText(station.kernel, size.label)).replace(/\s*\(.*\)$/, '') : '';
  const status = failed ? t('Stopped: the kernel rejected these parameters', 'Остановлено: ядро отклонило эти параметры')
    : growing && size ? t(`Growing the sample · ${sizeName} ${fmtInt(job.params[size.key])} of ${fmtInt(params[size.key])}`, `Выборка растёт · ${sizeName} ${fmtInt(job.params[size.key])} из ${fmtInt(params[size.key])}`)
    : t(`${playing ? 'Live' : 'Stopped'} · draw ${draws + 1} · seed ${seed}`, `${playing ? 'Идёт' : 'Остановлено'} · прогон ${draws + 1} · зерно ${seed}`);

  return (
    <div className="station-grid">
      <Panel label={t('Station parameters', 'Параметры станции')} className="parameters">
        <PanelHeading icon={<SlidersHorizontal size={16} aria-hidden />} title={t('Parameters', 'Параметры')} />
        <div className="parameter-body">
          {labelled.filter((p) => applies(p.when, params)).map((p) => {
            const choice = choicesOf(p);
            return choice ? (
              <Choice key={p.key} id={`p-${p.key}`} title={choice.title} options={choice.options} value={params[p.key]}
                onChange={(v) => setParams({ ...params, [p.key]: v })} />
            ) : (
              <Slider key={p.key} id={`p-${p.key}`} label={p.label} value={params[p.key]} display={show(params[p.key])}
                min={p.min} max={p.max} step={p.step} onChange={(v) => setParams({ ...params, [p.key]: v })} />
            );
          })}
          {declaredTexts.filter((p) => applies(p.when, params)).map((p) => (
            <TextField key={p.key} id={`p-${p.key}`} label={kernelText(station.kernel, p.label)} value={texts[p.key]} presets={p.presets}
              check={(v) => kernel.checkText?.(station.id, p.key, v) ?? null} translate={(s) => kernelText(station.kernel, s)}
              onChange={(v) => setTexts((x) => ({ ...x, [p.key]: v }))} />
          ))}
          <SeedField seed={seed} onSeed={(v) => { setSeed(v); setDraws(0); }} />
          <p className="parameter-hint">{t('Every change runs at once. Type exact values in the boxes: 0,5 · 20 000 · 1/3 · π/4.', 'Любое изменение применяется сразу. Точные значения вводятся в полях: 0,5 · 20 000 · 1/3 · π/4.')}</p>
        </div>
      </Panel>
      <Panel label={t('Station output', 'Результаты станции')} className="outputs">
        <AutoplayBar playback={playback} onStep={step} onRestart={size ? restart : undefined} status={status}
          progress={growing ? (grow + 1) / GROWTH.length : null} />
        {!view ? (
          <p className="station-status" role="status">{t('Running the first experiment…', 'Идёт первый эксперимент…')}</p>
        ) : 'error' in view ? (
          <p className="station-status" role="alert">{t('The kernel rejected these parameters: ', 'Ядро отклонило эти параметры: ')}{view.error}</p>
        ) : (
          <>
            {view.formula && view.formula.length > 0 && (
              <div className="live-formula" aria-label={t('Live formula', 'Живая формула')} role="group">
                {view.formula.map((line, i) => <div key={i} className="live-formula-line" data-on={lineFocus === i || undefined}><Tex tex={line} display /></div>)}
              </div>
            )}
            {view.beam && <Beam beam={view.beam} onParam={(key, v) => setParams((p) => ({ ...p, [key]: v }))} />}
            {view.outcomes && outcome?.ok && <OutcomeFlight outcomes={view.outcomes} drawKey={outcome.job.seed} />}
            {view.space && outcome?.ok && <OutcomeSpace space={view.space} drawKey={outcome.job.seed} />}
            {view.constructions && outcome?.ok && <Constructions data={view.constructions} drawKey={outcome.job.seed} />}
            {view.board && outcome?.ok && <Board board={view.board} drawKey={outcome.job.seed} onFocusLine={setLineFocus} />}
            {view.tree && outcome?.ok && <BayesTree tree={view.tree} drawKey={outcome.job.seed} />}
            {view.square && outcome?.ok && <EventSquare square={view.square} drawKey={outcome.job.seed} onParam={(key, v) => setParams((p) => ({ ...p, [key]: v }))} />}
            {view.surface && <Surface3D surface={view.surface} />}
            {view.series.length > 0 && (
              <div className="chart-stage">
                <Chart series={view.series} xLabel={view.axes?.x} yLabel={view.axes?.y} domain={view.domain} />
                {view.linked && <Chart series={view.linked.series} xLabel={view.linked.axes?.x} yLabel={view.linked.axes?.y} domain={view.linked.domain} height={200} />}
                <RidgeToggle draws={past} on={ridgeOn} onToggle={() => setRidgeOn((v) => !v)} />
              </div>
            )}
            {ridgeOn && <Ridge draws={past} axes={view.axes} />}
            {view.decisions && outcome?.ok && (
              <DecisionZones decisions={view.decisions} drawKey={outcome.job.seed}
                experimentKey={declared.filter((d) => !['truth', 'view', 'R'].includes(d.key)).map((d) => `${d.key}=${outcome.job.params[d.key]}`).join('&')} />
            )}
            <table className="readouts" aria-label={t('Readouts', 'Показания')}>
              <thead><tr><th scope="col">{t('Quantity', 'Величина')}</th><th scope="col">{t('Observed', 'Опыт')}</th><th scope="col">{t('Theory', 'Теория')}</th><th scope="col"><span className="sr-only">{t('Track', 'Следить')}</span></th></tr></thead>
              <tbody>
                {view.readouts.map((r, i) => (
                  <tr key={r.key + i} data-tracked={r.key === trackKey || undefined}>
                    <th scope="row"><MathText text={r.label} />{r.convention && <small><MathText text={r.convention} /></small>}</th>
                    <td>{cell(r.observed)}{r.unit && r.observed != null ? ` ${r.unit}` : ''}</td>
                    <td>{cell(r.theory)}{r.unit && r.theory != null ? ` ${r.unit}` : ''}</td>
                    <td className="readout-track">
                      {numeric(r.observed) && (
                        <button type="button" aria-pressed={r.key === trackKey} aria-label={t(`Follow ${mathToPlain(r.label)} across draws`, `Следить за величиной ${mathToPlain(r.label)} по прогонам`)}
                          title={t('Follow this quantity across draws', 'Следить за этой величиной по прогонам')} onClick={() => setTracked(r.key)}><Activity size={13} aria-hidden /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {trackKey && <Trace draws={past} readoutKey={trackKey} kernel={station.kernel} />}
            {view.notes.length > 0 && (
              <div className="station-notes">
                <PanelHeading icon={<CircleHelp size={16} aria-hidden />} title={t('Reading the view', 'Как читать результат')} />
                {view.notes.map((n, i) => <p key={i}><MathText text={n} /></p>)}
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
      <label htmlFor="station-seed">{t('Random seed', 'Зерно генератора')}</label>
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
      {!valid && <small id="station-seed-error">{t('Enter an integer from 0 to 4,294,967,295.', 'Введите целое число от 0 до 4 294 967 295.')}</small>}
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
      <span className="choice-title" id={`${id}-title`}><MathText text={title} /></span>
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
            <MathText text={o.label} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** One readout followed across draws: each dot is one experiment, the line their running mean. */
function Trace({ draws, readoutKey, kernel }: { draws: Draw[]; readoutKey: string; kernel: string }) {
  const lang = useLang();
  const rows = draws.map((d) => ({ draw: d.draw, r: d.result.readouts.find((r) => r.key === readoutKey) }));
  const values = rows.map((x) => (numeric(x.r?.observed) ? x.r.observed : NaN));
  const label = kernelText(kernel, rows.at(-1)?.r?.label ?? readoutKey);
  const theory = rows.at(-1)?.r?.theory;
  const sum = traceSummary(values, numeric(theory) ? theory : null);
  const series = useMemo<Series[]>(() => {
    const x = rows.map((r) => r.draw);
    let acc = 0, n = 0;
    const mean = values.map((v) => (Number.isFinite(v) ? ((acc += v), ++n, acc / n) : n ? acc / n : NaN));
    const out: Series[] = [{ id: 'draws', kind: 'points', x, y: values, label: t('one draw', 'один прогон') }];
    if (x.length > 1) out.push({ id: 'mean', kind: 'line', x, y: mean, label: t('mean of the draws', 'среднее по прогонам') });
    if (numeric(theory) && x.length) out.push({ id: 'theory', kind: 'line', x: [x[0], x[x.length - 1] + 0.001], y: [theory, theory], tone: 'signal', label: t('theory', 'теория') });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draws, readoutKey, lang]);
  return (
    <section className="trace" aria-label={t(`${mathToPlain(label)} across draws`, `${mathToPlain(label)} по прогонам`)}>
      <p className="trace-head">
        <b>{t('Across draws', 'По прогонам')}</b> · <MathText text={label} />
        {sum.count > 0 && <span> · {t('mean', 'среднее')} {show(sum.mean)}{sum.sd != null && <> ± {show(sum.sd)}</>} {t(`over ${sum.count} draw${sum.count === 1 ? '' : 's'}`, `за ${sum.count} ${plural(sum.count, 'прогон', 'прогона', 'прогонов')}`)}{sum.theory != null && <> · {t('theory', 'теория')} {show(sum.theory)}</>}</span>}
      </p>
      {draws.length < 2 ? (
        <p className="trace-empty">{t('Each new draw adds a dot here.', 'Каждый новый прогон добавляет сюда точку.')} {draws.length ? t('One so far.', 'Пока одна.') : ''}</p>
      ) : (
        <Chart series={series} xLabel={t('draw', 'прогон')} height={150} domain={{ y: traceDomain(values, sum.theory) }} />
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
    <button type="button" className="ridge-toggle" aria-pressed={on} onClick={onToggle} title={t('Stack the last draws into a rotatable 3D landscape', 'Сложить последние прогоны в поворотный трёхмерный рельеф')}>
      <Box size={13} aria-hidden /> {t('3D draws', '3D-прогоны')}
    </button>
  );
}
function Ridge({ draws, axes }: { draws: Draw[]; axes?: KernelResult['axes'] }) {
  const lang = useLang();
  const surface = useMemo(() => {
    const s = ridgeOf(ridgeRows(draws), { x: axes?.x ?? 'x', y: t('draw', 'прогон'), z: axes?.y ?? t('height', 'высота') });
    return s && { ...s, title: t(s.title ?? '', 'Последние прогоны рядом: каждый гребень — один эксперимент') };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draws, axes, lang]);
  if (!surface) return <p className="trace-empty">{t('The 3D view appears after three draws.', 'Трёхмерный вид появится после трёх прогонов.')} {draws.length ? t(`${draws.length} so far.`, `Пока ${draws.length}.`) : ''}</p>;
  return <Surface3D surface={surface} keyLabel={t(`Each ridge: one draw's ${axes?.y ?? 'curve'}`, `Каждый гребень — ${axes?.y ?? 'кривая'} одного прогона`)} />;
}

/** A station whose kernel has not landed yet: says what it will show and where the work is tracked. */
export function PendingStation({ station }: { station: KernelStationInfo }) {
  return (
    <div className="station-pending">
      <p className="edition"><i /> {t('KERNEL IN PROGRESS', 'ЯДРО В РАБОТЕ')}</p>
      <p><MathText text={station.summary} /></p>
      <p>
        {t('The station appears here as soon as ', 'Станция появится здесь, как только будет готово ')}<code translate="no">spikes/{station.kernel}/kernel.mjs</code>{t(' lands.', '.')}
      </p>
      <a href={`https://github.com/punyzxc/matstat-lab/issues/${station.issue}`} target="_blank" rel="noreferrer">
        {t('Track issue', 'Задача')} #{station.issue} <ExternalLink size={13} aria-hidden />
      </a>
    </div>
  );
}

