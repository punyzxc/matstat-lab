import type { ComponentType } from 'react';
import { FIGURES, figureParams, type FigureSpec } from './specs.mjs';
import type { FigureProps } from './kit';
import { CltFactory } from './clt-factory';
import { CiWall } from './ci-wall';

/** Live lecture figures by id. The spec (specs.mjs) says what they share; the component draws them. */
const components: Record<string, ComponentType<FigureProps>> = {
  'clt-factory': CltFactory,
  'ci-wall': CiWall,
};

export function findFigure(id: string): { spec: FigureSpec; Component: ComponentType<FigureProps> } | null {
  const spec = FIGURES[id], Component = components[id];
  return spec && Component ? { spec, Component } : null;
}
export { figureParams };
export type { FigureProps };
