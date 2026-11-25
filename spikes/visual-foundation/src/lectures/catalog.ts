import type { FigureRef, Lecture, Step } from './script';

/** Every lecture script in `spikes/visual-foundation/lectures/LNN.json`, bundled at build time. */
const files = import.meta.glob<Lecture>('../../lectures/L[0-9][0-9].json', { eager: true, import: 'default' });
export const lectures: Lecture[] = Object.values(files).sort((a, b) => a.lecture - b.lecture);
export const findLecture = (n: number) => lectures.find((l) => l.lecture === n) ?? null;

/** Each step's figure: its own, or the last one before it (story lectures, #110). */
export function resolveFigures(steps: Step[]): FigureRef[] {
  let last: FigureRef = steps.find((s) => s.figure)?.figure ?? { id: 'clt-factory', beat: 'source' };
  return steps.map((s) => (last = s.figure ? { ...s.figure, params: { ...(s.figure.id === last.id ? last.params : {}), ...s.figure.params } } : last));
}
