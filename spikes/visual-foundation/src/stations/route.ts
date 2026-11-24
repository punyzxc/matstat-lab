import { findStation, type OrbitId, orbits } from './catalog';

/**
 * The whole program state lives in the URL hash, so a copied link reopens the same view:
 *   #orbit/<orbit>                      the scene with one lecture orbit selected
 *   #station/<id>?seed=7&n=20           a station open inside the scene, with its seed and params
 *   #notes, #record                     scene drawers
 * Legacy prototype links (#module/<id>, #workspace, #observatory, #experiments) still resolve.
 */
export type Route = {
  orbit: OrbitId | null;
  station: string | null;
  seed: number | null;
  params: Record<string, number>;
  drawer: 'notes' | 'record' | null;
};

const empty = (): Route => ({ orbit: null, station: null, seed: null, params: {}, drawer: null });
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
  const [head, id] = path.split('/');
  if ((head === 'station' || head === 'module') && id && findStation(id)) route.station = id;
  if (head === 'orbit' && orbits.some((o) => o.id === id)) route.orbit = id as OrbitId;
  if (head === 'notes' || head === 'record') route.drawer = head;
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = decode(eq < 0 ? pair : pair.slice(0, eq));
    const raw = eq < 0 ? null : decode(pair.slice(eq + 1));
    if (!key || raw == null) continue;
    if (key === 'seed') {
      if (SEED.test(raw) && Number(raw) <= 4294967295) route.seed = Number(raw);
    } else if (NUMBER.test(raw) && Number.isFinite(Number(raw))) route.params[key] = Number(raw);
  }
  return route;
}

export function stationHash(id: string, seed?: number | null, params: Record<string, number> = {}) {
  const query = [
    ...(seed == null ? [] : [`seed=${seed}`]),
    ...Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${v}`),
  ].join('&');
  return `#station/${id}${query ? `?${query}` : ''}`;
}
export const orbitHash = (orbit: OrbitId) => `#orbit/${orbit}`;
