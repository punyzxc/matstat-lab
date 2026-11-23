import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Grid2X2, Pause, Play, RotateCw } from 'lucide-react';
import { FigureCaption, LabFooter, LabHeader } from './lab-shell';
import { SpecimenView } from './specimen-view';
import { Matrix, Trace } from './sample-readouts';
import { useStationReducedMotion } from './motion-preference';
import { collect, sources, type RunSettings, type Distribution } from './statistics';
import { modules, type ModuleId } from './modules';
import { resultFor, type LastResults } from './last-results';
import { PlateCanvas } from './plate-canvas';
import { earthPlate } from './globe';
import { OrbitLinks } from './orbit-links';
import { OrbitPreview } from './orbit-preview';
import './observatory.css';
import './orbital.css';

function useVisibleField(field: React.RefObject<HTMLDivElement | null>) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (!field.current) return;
    let inView = true;
    function measure() {
      setVisible(inView && !document.hidden);
    }
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      measure();
    });
    observer.observe(field.current);
    document.addEventListener('visibilitychange', measure);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', measure);
    };
  }, [field]);
  return visible;
}

export function Observatory({
  settings,
  initialModule,
  onSelect,
  onSample,
  results,
  lastVisited,
}: {
  settings: RunSettings;
  initialModule: ModuleId;
  onSelect: (m: ModuleId) => void;
  onSample: (s: RunSettings) => void;
  results: LastResults;
  lastVisited?: ModuleId;
}) {
  const reduced = useStationReducedMotion();
  const [paused, setPaused] = useState(false);
  const [mesh, setMesh] = useState(false);
  const [hover, setHover] = useState<ModuleId | null>(null);
  const [focus, setFocus] = useState<ModuleId | null>(null);
  const [study, setStudy] = useState(false);
  const field = useRef<HTMLDivElement>(null);
  const visible = useVisibleField(field);
  const playing = !paused && !reduced;
  const animating = playing && visible;
  const active = focus ?? hover ?? lastVisited ?? initialModule;
  const sample = useMemo(() => collect(settings), [settings]);
  return (
    <div className="atlas orbital-lab">
      <a className="skip" href="#experiments">
        Skip to experiments
      </a>
      <LabHeader home />
      <main className="lab-spread">
        <header className="orbit-heading">
          <div>
            <div className="edition">
              <i /> MONTE CARLO · RESEARCH STATION
            </div>
            <h1>
              Orbital <em>laboratory</em>
              <span aria-hidden="true">.</span>
            </h1>
          </div>
          <p>
            Explore the latest results.
            <br /> Select an instrument to continue.
          </p>
        </header>
        <section id="experiments" aria-labelledby="index-title" className="orbital-instruments">
          <h2 id="index-title" tabIndex={-1} className="orbit-sr">
            Experiments
          </h2>
          <div ref={field} className="orbital-field" data-playing={animating}>
            <div className="orbital-engine">
              <div className="orbital-beacons" aria-hidden="true">
                <i>+</i>
                <i>*</i>
                <i>+</i>
                <i>*</i>
                <i>+</i>
                <i>*</i>
                <i>+</i>
                <i>*</i>
              </div>
              <div className="orbital-reticle" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="orbital-disc">
                <PlateCanvas
                  create={earthPlate}
                  label="Earth point cloud with simulated orbital links and ASCII satellites"
                  playing={animating}
                  mesh={mesh}
                  cue={0}
                />
              </div>
              <div className="orbital-legend">
                <i /> EARTH <span>·</span> DATA CORE
              </div>
              <div className="orbital-controls" role="group" aria-label="Globe controls">
                <button
                  aria-pressed={mesh}
                  aria-label="Wireframe"
                  title="Toggle wireframe"
                  onClick={() => setMesh((v) => !v)}
                >
                  <Grid2X2 size={14} aria-hidden="true" />
                </button>
                <button
                  disabled={reduced}
                  aria-label={reduced ? 'Reduced motion enabled' : playing ? 'Pause motion' : 'Resume motion'}
                  title={reduced ? 'Reduced motion enabled' : playing ? 'Pause motion' : 'Resume motion'}
                  onClick={() => setPaused((v) => !v)}
                >
                  {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
                </button>
              </div>
            </div>
            <OrbitLinks field={field} active={active} playing={animating} />
            <nav className="orbital-nodes" aria-label="Laboratory modules">
              {modules.map((module, index) => (
                <div
                  key={module.id}
                  className="orbit-node"
                  data-orbit-id={module.id}
                  data-row={Math.floor(index / 2)}
                  data-side={index % 2 ? 'right' : 'left'}
                  data-active={active === module.id}
                  onPointerEnter={() => setHover(module.id)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setFocus(module.id)}
                  onBlur={() => setFocus(null)}
                >
                  <OrbitPreview
                    module={module}
                    snapshot={resultFor(results, module.id, settings)}
                    active={active === module.id}
                    animate={animating}
                    visited={lastVisited === module.id}
                    onActivate={() => onSelect(module.id)}
                  />
                </div>
              ))}
            </nav>
          </div>
          <div className="orbit-console">
            <div className="orbit-source">
              <i aria-hidden="true" />
              <span>ACTIVE SAMPLE</span>
              <strong>n = {settings.count.toLocaleString('en-US')}</strong>
            </div>
            <div className="orbit-model">
              <label htmlFor="atlas-model">Model</label>
              <span>
                <select
                  id="atlas-model"
                  name="atlas-model"
                  value={settings.distribution}
                  onChange={(e) =>
                    onSample({ ...settings, distribution: e.currentTarget.value as Distribution })
                  }
                >
                  {Object.entries(sources).map(([key, model]) => (
                    <option key={key} value={key}>
                      {model.label.split(' (')[0]}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} aria-hidden="true" />
              </span>
            </div>
            <div className="session-source">
              SEED <b>{settings.seed}</b>
            </div>
            <button
              className="resample"
              onClick={() => onSample({ ...settings, seed: (settings.seed + 1) >>> 0 })}
            >
              <RotateCw size={13} aria-hidden="true" /> Resample
            </button>
            <div className="orbit-formula" aria-hidden="true">
              x̄ₙ = Σ xᵢ / n <span>·· / ···</span>
            </div>
          </div>
        </section>
        <section className="record orbital-record" aria-labelledby="record-title">
          <div className="record-title">
            <h2 id="record-title">Sample record</h2>
            <p className="session-source">
              {sources[settings.distribution].label} · seed {settings.seed}
            </p>
          </div>
          <div className="record-figure">
            <FigureCaption number="A">Draw sequence</FigureCaption>
            <Trace sample={sample.slice(0, 48)} animate={playing} />
          </div>
          <div className="record-figure">
            <FigureCaption number="B">Frequency / ASCII</FigureCaption>
            <Matrix sample={sample} settings={settings} />
          </div>
        </section>
        <details className="orbital-study" onToggle={(e) => setStudy(e.currentTarget.open)}>
          <summary>Geometric study · Trefoil</summary>
          {study && (
            <SpecimenView
              settings={settings}
              sample={sample}
              playing={playing}
              reduced={reduced}
              toggle={() => setPaused((v) => !v)}
            />
          )}
        </details>
      </main>
      <LabFooter />
    </div>
  );
}
