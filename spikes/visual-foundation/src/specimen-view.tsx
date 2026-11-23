import { useState } from 'react';
import { ArrowLeftRight, Pause, Play, Grid2X2 } from 'lucide-react';
import { PlateCanvas } from './plate-canvas';
import { wovenPlate, etchedPlate } from './trefoil';
import { earthPlate } from './globe';
import { sources, type RunSettings } from './statistics';
import { FigureCaption } from './lab-shell';

export function SpecimenView({
  playing,
  reduced,
  toggle,
  settings,
  sample,
}: {
  playing: boolean;
  reduced: boolean;
  toggle: () => void;
  settings: RunSettings;
  sample: number[];
}) {
  const [specimen, setSpecimen] = useState<'knot' | 'earth'>('knot');
  const [mesh, setMesh] = useState(false);
  const knot = specimen === 'knot';
  const [draw, setDraw] = useState(0);
  const index = draw % sample.length;
  const value = sample[index];
  const cue = sources[settings.distribution].cdf(value, settings.scale);
  return (
    <figure className="specimen">
      <figcaption>
        <FigureCaption number={knot ? '01' : '02'}>{knot ? 'Trefoil study' : 'Orbital study'}</FigureCaption>
      </figcaption>
      <div className="specimen-stage">
        <div className="register reg-nw" aria-hidden="true" />
        <div className="register reg-se" aria-hidden="true" />
        <PlateCanvas
          create={knot ? wovenPlate : earthPlate}
          fallback={knot ? etchedPlate : undefined}
          label={
            knot
              ? 'Trefoil knot, a rotating sculptural study of the (2, 3) torus knot'
              : 'Earth point cloud with simulated links'
          }
          playing={playing}
          mesh={mesh}
          cue={cue}
        />
        {knot && (
          <button
            className="draw-probe"
            aria-label="Inspect next draw"
            title="Advance the measured probability coordinate"
            onClick={() => setDraw((i) => (i + 1) % sample.length)}
          >
            <span>
              <i /> DRAW {String(index + 1).padStart(3, '0')} →
            </span>
            <b>x = {value.toFixed(3)}</b>
            <small>F(x) = {cue.toFixed(3)}</small>
          </button>
        )}
        <span className="object-tag" aria-hidden="true">
          {knot ? 'T (2,3)' : 'λ / φ'}
        </span>
      </div>
      <div className="specimen-toolbar">
        <span className="drag-hint">
          <ArrowLeftRight size={13} /> Drag to rotate
        </span>
        <div className="scene-choice" role="group" aria-label="Geometric specimen">
          <button aria-pressed={knot} onClick={() => setSpecimen('knot')}>
            Knot
          </button>
          <button aria-pressed={!knot} onClick={() => setSpecimen('earth')}>
            Earth
          </button>
        </div>
        <button
          className="scene-control"
          aria-label="Wireframe"
          title="Toggle wireframe"
          aria-pressed={mesh}
          onClick={() => setMesh((v) => !v)}
        >
          <Grid2X2 size={14} />
        </button>
        <button
          className="scene-control"
          disabled={reduced}
          aria-label={reduced ? 'Reduced motion enabled' : playing ? 'Pause rotation' : 'Resume rotation'}
          title={reduced ? 'Reduced motion enabled' : playing ? 'Pause motion' : 'Resume motion'}
          onClick={toggle}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
      </div>
    </figure>
  );
}
