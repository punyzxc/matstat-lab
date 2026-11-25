import type { ComponentType } from 'react';
import { FIGURES, figureParams, russianSpec, type FigureSpec } from './specs.mjs';
import { getLang } from '../../i18n-core';
import type { FigureProps } from './kit';
import { CltFactory } from './clt-factory';
import { CiWall } from './ci-wall';
import { EstimateCloud } from './estimate-cloud';

/** Live lecture figures by id. The spec (specs.mjs) says what they share; the component draws them. */
const components: Record<string, ComponentType<FigureProps>> = {
  'clt-factory': CltFactory,
  'ci-wall': CiWall,
  'estimate-cloud': EstimateCloud,
};

const russian = new Map<string, FigureSpec>();

/** The figure and its spec in the current language. */
export function findFigure(id: string): { spec: FigureSpec; Component: ComponentType<FigureProps> } | null {
  const spec = FIGURES[id], Component = components[id];
  if (!spec || !Component) return null;
  if (getLang() === 'en') return { spec, Component };
  let ru = russian.get(id);
  if (!ru) russian.set(id, (ru = russianSpec(id, spec)));
  return { spec: ru, Component };
}
export { figureParams };
export type { FigureProps };
