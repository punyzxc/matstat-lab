import '@fontsource-variable/space-grotesk';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './style.css';
import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as Tabs from '@radix-ui/react-tabs';
import { MotionConfig, motion, useReducedMotion } from 'motion/react';
import {
  Activity, ArrowDownToLine, Atom, ChartColumn, ChevronDown, ChevronRight, CircleHelp,
  FlaskConical, Maximize, Minimize, Pause, Play, RotateCcw, ScanLine, Sigma, SlidersHorizontal, Waves,
} from 'lucide-react';
import { Plot } from './plot.tsx';
import { asciiHistogram, collect, histogram, initialSettings, moments, sources, type Distribution, type RunSettings } from './statistics.ts';
import { Button, Panel, PanelHeading, Slider, Stat } from './ui.tsx';

type Phase = 'running' | 'paused' | 'complete';
type Run = { settings: RunSettings; all: number[]; shown: number; phase: Phase };
const newRun = (settings: RunSettings, immediate: boolean): Run => ({
  settings, all: collect(settings), shown: immediate ? settings.count : 0, phase: immediate ? 'complete' : 'running',
});

const number = new Intl.NumberFormat('en-US');
const fixed = (value: number | null | undefined) => value == null ? '—' : (Math.abs(value) < 0.0005 ? 0 : value).toFixed(3);
const modes = ['Histogram', 'ECDF', 'ASCII'] as const;
const guide = {
  Histogram: 'Frequency density · count / (n × bin width)',
  ECDF: 'Cumulative probability · observations ≤ x / n',
  ASCII: 'Relative bin counts · @ marks occupied levels',
};

function Workspace() {
  const reduced = useReducedMotion();
  const [run, setRun] = useState(() => newRun(initialSettings, true));
  const [draft, setDraft] = useState(initialSettings);
  const [seedText, setSeedText] = useState(String(initialSettings.seed));
  const [projector, setProjector] = useState(false);
  const [theory, setTheory] = useState(true);
  const [mode, setMode] = useState<(typeof modes)[number]>('Histogram');
  const [exported, setExported] = useState(false);
  const validSeed = /^\d{1,10}$/.test(seedText) && Number(seedText) <= 4294967295;
  const busy = run.phase === 'running';
  const draftChanged = draft.distribution !== run.settings.distribution || draft.scale !== run.settings.scale ||
    draft.count !== run.settings.count || Number(seedText) !== run.settings.seed;
  const sample = useMemo(() => run.all.slice(0, run.shown), [run.all, run.shown]);
  const model = sources[run.settings.distribution];
  const domain = model.domain(run.settings.scale);
  const hist = histogram(sample, domain, 28, run.settings.count);
  const finalBins = useMemo(() => histogram(run.all, sources[run.settings.distribution].domain(run.settings.scale)), [run.all, run.settings]);
  const densityPeak = Math.max(...finalBins.density);
  const summary = moments(sample);
  const [theoreticalMean, theoreticalVariance] = model.theory(run.settings.scale);

  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => {
      setRun(current => {
        if (current.phase !== 'running') return current;
        const shown = Math.min(current.all.length, current.shown + Math.ceil(current.all.length / 19));
        return { ...current, shown, phase: shown === current.all.length ? 'complete' : 'running' };
      });
    }, 43);
    return () => clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    if (!exported) return;
    const timer = window.setTimeout(() => setExported(false), 2200);
    return () => clearTimeout(timer);
  }, [exported]);

  function action() {
    if (run.phase === 'running') {
      setRun(current => ({ ...current, phase: 'paused' }));
    } else if (run.phase === 'paused') {
      setRun(current => ({ ...current, phase: 'running' }));
    } else if (validSeed) {
      setRun(newRun({ ...draft, seed: Number(seedText) }, reduced === true));
    }
  }

  function reset() {
    setDraft(initialSettings);
    setSeedText(String(initialSettings.seed));
    setRun(newRun(initialSettings, true));
  }

  function download() {
    const { distribution, scale, seed } = run.settings;
    const rows = sample.map((value, index) => [distribution, scale, seed, index + 1, value].join(','));
    const file = new Blob([['distribution,scale,seed,index,value', ...rows].join('\r\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `statum-${distribution}-${seed}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(true);
  }

  const status = busy ? 'Running simulation' : run.phase === 'paused' ? 'Simulation paused' : `${number.format(run.shown)} observations complete`;
  const actionText = busy ? 'Pause simulation' : run.phase === 'paused' ? 'Resume simulation' : 'Run simulation';

  return <div className={projector ? 'app app--projector' : 'app'}>
    <a className="skip" href="#workspace">Skip to experiment</a>
    <header className="topbar">
      <a className="brand" href="#workspace" aria-label="STATUM LAB workspace">
        <span className="brand-icon"><Atom size={21} aria-hidden /></span>
        <span>STATUM<span className="wordmark-muted"> LAB</span></span>
      </a>
      <div className="top-path" aria-label="Workspace location">Laboratory <ChevronRight aria-hidden size={14} /> <span>Distribution Explorer</span></div>
      <div className="top-actions">
        <span className="local"><i /> LOCAL SESSION</span>
        <Button variant="ghost" aria-pressed={projector} onClick={() => setProjector(!projector)}
          aria-label="Projector" title={projector ? 'Leave projector mode' : 'Enter projector mode'}>
          {projector ? <Minimize size={15} aria-hidden /> : <Maximize size={15} aria-hidden />}
          <span>Projector</span>
        </Button>
      </div>
    </header>

    <div className="shell">
      <aside className="sidebar" aria-label="Laboratory modules">
        <p className="nav-label">EXPERIMENTS</p>
        <nav aria-label="Experiments">
          <a className="nav-item nav-active" href="#workspace" aria-current="page" aria-label="Distribution Explorer"><ChartColumn size={16} aria-hidden /><span>Distribution Explorer</span></a>
          <div className="nav-item nav-future"><Waves size={16} aria-hidden /><span>Convergence</span></div>
          <div className="nav-item nav-future"><Sigma size={16} aria-hidden /><span>Estimation</span></div>
          <div className="nav-item nav-future"><Activity size={16} aria-hidden /><span>Confidence Intervals</span></div>
        </nav>
        <div className="nav-footer"><span className="nav-foot-symbol"><FlaskConical size={15} aria-hidden /></span><span>Monte Carlo Lab<small>VISUAL PROTOTYPE</small></span></div>
      </aside>

      <main id="workspace" tabIndex={-1} className="main">
        <motion.section className="hero" aria-labelledby="hero-title" initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: 'easeOut' }}>
          <div className="hero-art" aria-hidden />
          <div className="hero-grid" aria-hidden />
          <div className="hero-corner hero-corner-top" aria-hidden />
          <div className="hero-corner hero-corner-bottom" aria-hidden />
          <div className="hero-body">
            <p className="eyebrow"><span /> MONTE CARLO LABORATORY</p>
            <h1 id="hero-title">Distribution<br />Explorer</h1>
            <p className="hero-copy">Draw a random sample and see how it compares with the theoretical distribution.</p>
          </div>
          <span className="scene-label" aria-hidden><ScanLine size={13} /> PROBABILITY FIELD</span>
        </motion.section>

        <div className="workspace-title">
          <h2>Experiment workspace</h2>
          <Button onClick={download} disabled={!sample.length} aria-label="Export CSV"><ArrowDownToLine size={15} aria-hidden /> {exported ? 'Exported' : 'Export CSV'}</Button>
        </div>

        <div className="instrument-grid">
          <Panel label="Simulation parameters" className="parameters">
            <PanelHeading icon={<SlidersHorizontal size={16} aria-hidden />} title="Parameters" />
            <div className="parameter-body">
              <label htmlFor="distribution">Distribution</label>
              <div className="select-field">
                <select id="distribution" name="distribution" value={draft.distribution} disabled={run.phase !== 'complete'}
                  onChange={event => setDraft({ ...draft, distribution: event.currentTarget.value as Distribution })}>
                  {Object.entries(sources).map(([key, source]) => <option key={key} value={key}>{source.label}</option>)}
                </select>
                <ChevronDown size={16} aria-hidden />
              </div>
              <fieldset disabled={run.phase !== 'complete'} aria-label="Sample parameters">
                <Slider id="sample-size" label="Sample size" value={draft.count} display={number.format(draft.count)}
                  min={64} max={2048} step={64} onChange={count => setDraft({ ...draft, count })} />
                <Slider id="distribution-scale" label={sources[draft.distribution].parameter} value={draft.scale}
                  display={draft.scale.toFixed(2)} min={0.5} max={2.5} step={0.05} onChange={scale => setDraft({ ...draft, scale })} />
                <div className="seed-field">
                  <label htmlFor="seed">Random seed</label>
                  <input inputMode="numeric" id="seed" name="seed" autoComplete="off" value={seedText}
                    aria-invalid={!validSeed} aria-describedby={!validSeed ? 'seed-error' : undefined}
                    onChange={event => setSeedText(event.currentTarget.value)} />
                  {!validSeed && <small id="seed-error">Enter an integer from 0 to 4,294,967,295.</small>}
                </div>
              </fieldset>
            </div>
            <div className="parameter-actions">
              <Button variant="primary" disabled={run.phase === 'complete' && !validSeed} onClick={action}>
                {busy ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}{actionText}
              </Button>
              <Button aria-label="Reset parameters and run" title="Reset parameters and run" onClick={reset}><RotateCcw size={16} aria-hidden /></Button>
            </div>
            <div className="run-meta">
              <span className={busy ? 'signal signal--active' : 'signal'} />
              <span role="status">{status}</span>
              {draftChanged && run.phase === 'complete' && <span className="pending">Parameters changed</span>}
            </div>
            {run.phase !== 'complete' && <progress aria-label="Simulation progress" max={run.settings.count} value={run.shown} />}
          </Panel>

          <Panel label="Experiment output" className="outputs">
            <Tabs.Root value={mode} onValueChange={value => setMode(value as (typeof modes)[number])}>
              <PanelHeading icon={<Activity size={17} aria-hidden />} title="Distribution output"
                trailing={<Tabs.List aria-label="Data view" className="tabs">{modes.map(item => <Tabs.Trigger key={item} value={item}>{item}</Tabs.Trigger>)}</Tabs.List>} />
              <div className="plot-toolbar">
                <span className="plot-model">{run.settings.distribution === 'normal' ? 'Normal' : model.label} distribution <b>{model.notation}</b></span>
                <label className="theory-toggle">
                  <input type="checkbox" checked={theory} disabled={mode === 'ASCII'} onChange={event => setTheory(event.currentTarget.checked)} />
                  <span aria-hidden /><span>Theory overlay</span>
                </label>
              </div>
              {modes.map(item => <Tabs.Content key={item} value={item} className="tab-content">
                <motion.div initial={reduced ? false : { opacity: 0.45 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : 0.16 }}>
                  <p className="plot-axis">{item === 'Histogram' && run.phase !== 'complete' ? 'Accumulating density · count / (target n × bin width)' : guide[item]}</p>
                  {item === 'ASCII' ?
                    <div className="ascii"><pre aria-hidden data-testid="ascii-data">{asciiHistogram(hist.counts, 12, Math.max(1, ...finalBins.counts))}</pre>
                      <p>Bin counts · {number.format(sample.length)} observations</p></div>
                    : <Plot sample={sample} settings={run.settings} mode={item === 'ECDF' ? 'ecdf' : 'histogram'} showTheory={theory} densityPeak={densityPeak} />}
                </motion.div>
              </Tabs.Content>)}
              <div className="chart-legend">
                <span><i /> Observed sample</span>
                {theory && mode !== 'ASCII' && <span><i className="line-key" /> Theoretical model</span>}
                {hist.outside > 0 && <span>{hist.outside} outside visible range</span>}
              </div>
            </Tabs.Root>
            <dl className="stats">
              <Stat label="Sample mean" actual={fixed(summary?.mean)} theoretical={fixed(theoreticalMean)} id="sample-mean" />
              <Stat label="Sample variance" actual={fixed(summary?.variance)} theoretical={fixed(theoreticalVariance)} />
              <Stat label="Std. deviation" actual={fixed(summary?.deviation)} theoretical={fixed(Math.sqrt(theoreticalVariance))} />
              <Stat label="Observations" referenceLabel="Target" actual={number.format(sample.length)} theoretical={number.format(run.settings.count)} />
            </dl>
          </Panel>
        </div>

        <Panel label="Theory and bin data" className="theory-panel">
          <PanelHeading icon={<CircleHelp size={16} aria-hidden />} title="Reading the experiment" />
          <div className="theory-body">
            <div><p>{model.description}</p><p>Sample variance uses n − 1. The histogram, empirical CDF and ASCII view all use the same seed and observations.</p>{run.settings.distribution === 'normal' && <p>The normal CDF uses a numerical approximation.</p>}</div>
            <details>
              <summary>View bin data</summary>
              <div className="table-scroll">
                <table aria-label="Histogram bins"><thead><tr><th scope="col">Range</th><th scope="col">Count</th><th scope="col">Density</th></tr></thead>
                  <tbody>{hist.counts.map((count, index) => {
                    const lo = domain[0] + hist.width * index;
                    return <tr key={index}><th scope="row">{fixed(lo)} – {fixed(lo + hist.width)}</th><td>{count}</td><td>{fixed(hist.density[index])}</td></tr>;
                  })}</tbody>
                </table>
              </div>
            </details>
          </div>
        </Panel>
      </main>
    </div>
  </div>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><MotionConfig reducedMotion="user"><Workspace /></MotionConfig></StrictMode>,
);

