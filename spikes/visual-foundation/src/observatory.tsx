import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Grid2X2, Pause, Play, RotateCw } from 'lucide-react';
import { FigureCaption, LabHeader } from './lab-shell';
import { orbits, stationsOf, type OrbitId } from './stations/catalog';
import { StationCard } from './stations/station-card';
import { SpecimenView } from './specimen-view';
import { Matrix, Trace } from './sample-readouts';
import { useStationReducedMotion } from './motion-preference';
import { collect, sources, type RunSettings, type Distribution } from './statistics';
import { modules } from './modules';
import { resultFor, type LastResults } from './last-results';
import { PlateCanvas } from './plate-canvas';
import { earthPlate } from './globe';
import { OrbitLinks } from './orbit-links';
import { OrbitPreview } from './orbit-preview';
import './observatory.css';
import './orbital.css';
import './stations/scene.css';

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
  orbit,
  openStation,
  openKey = null,
  onSample,
  results,
  lastVisited,
  overlay,
}: {
  settings: RunSettings;
  orbit: OrbitId;
  openStation: string | null;
  /** What is open in the scene (a station id, 'notes' or 'record'); focus returns to its opener on close. */
  openKey?: string | null;
  onSample: (s: RunSettings) => void;
  results: LastResults;
  lastVisited?: string;
  overlay?: ReactNode;
}) {
  const reduced = useStationReducedMotion();
  const [paused, setPaused] = useState(false);
  const [mesh, setMesh] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const field = useRef<HTMLDivElement>(null);
  const visible = useVisibleField(field);
  const playing = !paused && !reduced;
  const animating = playing && visible;
  const opened = useRef<string | null>(null);
  useEffect(() => {
    const previous = opened.current;
    opened.current = openKey;
    if (!previous || openKey) return;
    const target =
      previous === 'notes' || previous === 'record'
        ? document.querySelector<HTMLElement>(`.lab-session a[href="#${previous}"]`)
        : document.querySelector<HTMLElement>(`.orbit-node[data-orbit-id="${previous}"] a`);
    target?.focus({ preventScroll: true });
  }, [openKey]);
  const orbitStations = stationsOf(orbit);
  const current = orbits.find((o) => o.id === orbit)!;
  const active = openStation ?? focus ?? hover ?? (orbitStations.some((s) => s.id === lastVisited) ? lastVisited! : orbitStations[0].id);
  return (
    <div className="atlas orbital-lab" data-dock={overlay ? 'open' : 'closed'}>
      <a className="skip" href="#stations" onClick={(e) => { e.preventDefault(); document.querySelector<HTMLElement>('.orbital-nodes a')?.focus(); }}>
        Skip to stations
      </a>
      <LabHeader orbit={orbit} />
      <main className="lab-spread">
        <header className="orbit-heading">
          <div>
            <div className="edition">
              <i /> ORBIT {current.numeral} · {current.lectures.toUpperCase()}
            </div>
            <h1>
              Orbital <em>laboratory</em>
              <span aria-hidden="true">.</span>
            </h1>
          </div>
          <p>
            {current.name}. Open a station to run it.
            <br /> Every run is seeded and reproducible.
          </p>
        </header>
        <section id="stations" aria-labelledby="index-title" className="orbital-instruments">
          <h2 id="index-title" tabIndex={-1} className="orbit-sr">
            {current.name} stations
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
            <OrbitLinks key={orbit} field={field} active={active} playing={animating && !overlay} />
            <nav className="orbital-nodes" aria-label={`${current.name} stations`} inert={overlay ? true : undefined}>
              {orbitStations.map((station, index) => {
                const legacy = station.kind === 'legacy' ? modules.find((m) => m.id === station.module)! : null;
                return (
                  <div
                    key={station.id}
                    className="orbit-node"
                    data-orbit-id={station.id}
                    data-row={Math.floor(index / 2)}
                    data-side={index % 2 ? 'right' : 'left'}
                    data-active={active === station.id}
                    onPointerEnter={() => setHover(station.id)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setFocus(station.id)}
                    onBlur={() => setFocus(null)}
                  >
                    {legacy ? (
                      <OrbitPreview
                        module={legacy}
                        snapshot={resultFor(results, legacy.id, settings)}
                        active={active === station.id}
                        animate={animating && !overlay}
                        visited={lastVisited === station.id}
                      />
                    ) : (
                      station.kind === 'kernel' && <StationCard station={station} active={active === station.id} />
                    )}
                  </div>
                );
              })}
            </nav>
            {overlay}
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
        
      </main>
    </div>
  );
}

/** The prototype's sample record and trefoil study, now a scene drawer instead of page sections below the fold. */
export function SampleRecord({ settings }: { settings: RunSettings }) {
  const reduced = useStationReducedMotion();
  const [paused, setPaused] = useState(false);
  const sample = useMemo(() => collect(settings), [settings]);
  const playing = !paused && !reduced;
  return (
    <div className="record orbital-record">
      <p className="session-source">
        {sources[settings.distribution].label} · seed {settings.seed}
      </p>
      <div className="record-figure">
        <FigureCaption number="A">Draw sequence</FigureCaption>
        <Trace sample={sample.slice(0, 48)} animate={playing} />
      </div>
      <div className="record-figure">
        <FigureCaption number="B">Frequency / ASCII</FigureCaption>
        <Matrix sample={sample} settings={settings} />
      </div>
      <div className="record-figure">
        <FigureCaption number="C">Geometric study · Trefoil</FigureCaption>
        <SpecimenView settings={settings} sample={sample} playing={playing} reduced={reduced} toggle={() => setPaused((v) => !v)} />
      </div>
    </div>
  );
}
