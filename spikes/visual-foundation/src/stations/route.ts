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
const legacy: Record<string, string> = { '#workspace': 'distribution' };

export function parseRoute(hash: string): Route {
  const route = empty();
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  if (legacy[hash]) route.station = legacy[hash];
  const [head, id] = path.split('/');
  if ((head === 'station' || head === 'module') && id && findStation(id)) route.station = id;
  if (head === 'orbit' && orbits.some((o) => o.id === id)) route.orbit = id as OrbitId;
  if (head === 'notes' || head === 'record') route.drawer = head;
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const [key, raw] = pair.split('=').map(decodeURIComponent);
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    if (key === 'seed') {
      if (Number.isInteger(value) && value >= 0 && value <= 4294967295) route.seed = value;
    } else route.params[key] = value;
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
