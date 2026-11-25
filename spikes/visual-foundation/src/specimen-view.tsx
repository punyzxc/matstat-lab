import { useState } from 'react';
import { ArrowLeftRight, Pause, Play, Grid2X2 } from 'lucide-react';
import { PlateCanvas } from './plate-canvas';
import { wovenPlate, etchedPlate } from './trefoil';
import { earthPlate } from './globe';
import { sources, type RunSettings } from './statistics';
import { FigureCaption } from './lab-shell';
import { dec, t } from './i18n';

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
        <FigureCaption number={knot ? '01' : '02'}>{knot ? t('Trefoil study', 'Этюд «Трилистник»') : t('Orbital study', 'Этюд «Орбита»')}</FigureCaption>
      </figcaption>
      <div className="specimen-stage">
        <div className="register reg-nw" aria-hidden="true" />
        <div className="register reg-se" aria-hidden="true" />
        <PlateCanvas
          create={knot ? wovenPlate : earthPlate}
          fallback={knot ? etchedPlate : undefined}
          label={
            knot
              ? t('Trefoil knot, a rotating sculptural study of the (2, 3) torus knot', 'Узел-трилистник: вращающийся скульптурный этюд торического узла (2, 3)')
              : t('Earth point cloud with simulated links', 'Облако точек Земли со смоделированными связями')
          }
          playing={playing}
          mesh={mesh}
          cue={cue}
        />
        {knot && (
          <button
            className="draw-probe"
            aria-label={t('Inspect next draw', 'Следующее значение')}
            title={t('Advance the measured probability coordinate', 'Перейти к следующей вероятностной координате')}
            onClick={() => setDraw((i) => (i + 1) % sample.length)}
          >
            <span>
              <i /> {t('DRAW', 'ЗНАЧЕНИЕ')} {String(index + 1).padStart(3, '0')} →
            </span>
            <b>x = {dec(value.toFixed(3))}</b>
            <small>F(x) = {dec(cue.toFixed(3))}</small>
          </button>
        )}
        <span className="object-tag" aria-hidden="true">
          {knot ? 'T (2,3)' : 'λ / φ'}
        </span>
      </div>
      <div className="specimen-toolbar">
        <span className="drag-hint">
          <ArrowLeftRight size={13} /> {t('Drag to rotate', 'Перетащите, чтобы повернуть')}
        </span>
        <div className="scene-choice" role="group" aria-label={t('Geometric specimen', 'Геометрический образец')}>
          <button aria-pressed={knot} onClick={() => setSpecimen('knot')}>
            {t('Knot', 'Узел')}
          </button>
          <button aria-pressed={!knot} onClick={() => setSpecimen('earth')}>
            {t('Earth', 'Земля')}
          </button>
        </div>
        <button
          className="scene-control"
          aria-label={t('Wireframe', 'Каркас')}
          title={t('Toggle wireframe', 'Показать каркас')}
          aria-pressed={mesh}
          onClick={() => setMesh((v) => !v)}
        >
          <Grid2X2 size={14} />
        </button>
        <button
          className="scene-control"
          disabled={reduced}
          aria-label={reduced ? t('Reduced motion enabled', 'Включено уменьшение движения') : playing ? t('Pause rotation', 'Остановить вращение') : t('Resume rotation', 'Продолжить вращение')}
          title={reduced ? t('Reduced motion enabled', 'Включено уменьшение движения') : playing ? t('Pause motion', 'Остановить движение') : t('Resume motion', 'Продолжить движение')}
          onClick={toggle}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
      </div>
    </figure>
  );
}
