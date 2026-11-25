import { findStation, type OrbitId, orbits } from './catalog';

/**
 * The whole program state lives in the URL hash, so a copied link reopens the same view:
 *   #orbit/<orbit>                      the scene with one lecture orbit selected
 *   #station/<id>?seed=7&n=20           a station open inside the scene, with its seed and params
 *   #notes, #record, #lectures          scene drawers
 *   #lecture/<n>/<step>?present=1       a lecture walkthrough at one step (1-based), optionally in presenter mode
 *   #station/<id>?…&lecture=3&step=2    a station opened from a lecture step; the dock offers "Back to lecture"
 * Legacy prototype links (#module/<id>, #workspace, #observatory, #experiments) still resolve.
 */
export type Route = {
  orbit: OrbitId | null;
  station: string | null;
  seed: number | null;
  params: Record<string, number>;
  /** Typed text parameters, such as a region `y < x^2` (#90). */
  texts: Record<string, string>;
  /** Snapshots of the station (#114), as written in the address: `snap=A7~n:10`. */
  snaps: string[];
  drawer: 'notes' | 'record' | 'lectures' | null;
  /** The open lecture walkthrough, if any. */
  lecture: { n: number; step: number } | null;
  /** The lecture step a station was opened from (`lecture` and `step` in the station query). */
  back: { n: number; step: number } | null;
  present: boolean;
};

const empty = (): Route => ({ orbit: null, station: null, seed: null, params: {}, texts: {}, snaps: [], drawer: null, lecture: null, back: null, present: false });
const lectureNumber = (v: unknown) => (typeof v === 'string' && /^\d{1,2}$/.test(v) && +v >= 1 && +v <= 12 ? +v : null);
const stepNumber = (v: unknown) => (typeof v === 'string' && /^\d{1,3}$/.test(v) && +v >= 1 ? +v : null);
const legacy: Record<string, string> = { workspace: 'distribution' };
const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
};
const SEED = /^\d{1,10}$/;
const NUMBER = /^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i;

export function parseRoute(hash: string): Route {
  const route = empty();
  const body = hash.replace(/^#/, '');
  const cut = body.indexOf('?');
  const path = cut < 0 ? body : body.slice(0, cut);
  const query = cut < 0 ? '' : body.slice(cut + 1).replace(/\?/g, '&');
  if (legacy[path]) route.station = legacy[path];
  const [head, id, stepPart] = path.split('/');
  if ((head === 'station' || head === 'module') && id && findStation(id)) route.station = id;
  if (head === 'orbit' && orbits.some((o) => o.id === id)) route.orbit = id as OrbitId;
  if (head === 'notes' || head === 'record' || head === 'lectures') route.drawer = head;
  if (head === 'lecture' && lectureNumber(id)) route.lecture = { n: lectureNumber(id)!, step: stepNumber(stepPart ?? '1') ?? 1 };
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = decode(eq < 0 ? pair : pair.slice(0, eq));
    const raw = eq < 0 ? null : decode(pair.slice(eq + 1));
    if (!key || raw == null) continue;
    if (key === 'seed') {
      if (SEED.test(raw) && Number(raw) <= 4294967295) route.seed = Number(raw);
    } else if (key === 'present') {
      route.present = raw === '1';
    } else if (key === 'snap') {
      if (raw.length <= 400 && route.snaps.length < 4) route.snaps.push(raw);
    } else if (key === 'lecture' || key === 'step') {
      continue;
    } else if (NUMBER.test(raw) && Number.isFinite(Number(raw))) route.params[key] = Number(raw);
    else if (raw.length <= 200) route.texts[key] = raw;
  }
  if (route.station) {
    const q = new URLSearchParams(query);
    const n = lectureNumber(q.get('lecture'));
    if (n) route.back = { n, step: stepNumber(q.get('step')) ?? 1 };
  } else route.present = route.present && Boolean(route.lecture);
  return route;
}

export type LectureRef = { n: number; step: number; present?: boolean };
export function stationHash(id: string, seed?: number | null, params: Record<string, number> = {}, from?: LectureRef | null, texts: Record<string, string> = {}, snaps: readonly string[] = []) {
  const query = [
    ...(seed == null ? [] : [`seed=${seed}`]),
    ...Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${v}`),
    ...Object.entries(texts).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`),
    ...snaps.map((s) => `snap=${encodeURIComponent(s).replace(/%7E/gi, '~').replace(/%3A/gi, ':')}`),
    ...(from ? [`lecture=${from.n}`, `step=${from.step}`, ...(from.present ? ['present=1'] : [])] : []),
  ].join('&');
  return `#station/${id}${query ? `?${query}` : ''}`;
}
export const orbitHash = (orbit: OrbitId) => `#orbit/${orbit}`;
export const lectureHash = ({ n, step, present }: LectureRef) => `#lecture/${n}/${step}${present ? '?present=1' : ''}`;
