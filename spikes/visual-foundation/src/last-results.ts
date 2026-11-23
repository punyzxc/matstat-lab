import { modules, type ModuleId } from './modules.ts';
import { sources, type RunSettings } from './statistics.ts';

export type LastResult = { settings: RunSettings; size: number };
export type LastResults = Partial<Record<ModuleId, LastResult>>;
export const historyPrefix = 'statum-lab:v1:';
const moduleIds = modules.map(({ id }) => id);

export function resultFor(
  results: LastResults,
  id: ModuleId,
  settings: RunSettings,
): LastResult & { saved: boolean } {
  const result = results[id];
  return result ? { ...result, saved: true } : { settings, size: settings.count, saved: false };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function integerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export function parseLastResult(source: string | null, id: ModuleId): LastResult | undefined {
  if (!source) return undefined;
  try {
    const result: unknown = JSON.parse(source);
    if (!isRecord(result) || !isRecord(result.settings)) return undefined;
    const { distribution, scale, count, seed } = result.settings;
    const { size } = result;
    if (
      typeof distribution !== 'string' ||
      !Object.hasOwn(sources, distribution) ||
      typeof scale !== 'number' ||
      !Number.isFinite(scale) ||
      scale < 0.5 ||
      scale > 2.5 ||
      !integerInRange(count, 64, 2048) ||
      !integerInRange(seed, 0, 0xffffffff) ||
      !integerInRange(size, 8, count) ||
      (id === 'distribution' && size !== count)
    ) {
      return undefined;
    }
    return {
      settings: { distribution: distribution as RunSettings['distribution'], scale, count, seed },
      size,
    };
  } catch {
    return undefined;
  }
}

function read(key: string) {
  try {
    return localStorage.getItem(historyPrefix + key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(historyPrefix + key, value);
  } catch {
    /* Working results remain in memory. */
  }
}

export function readLastResults(): LastResults {
  const results: LastResults = {};
  for (const id of moduleIds) {
    const result = parseLastResult(read(id), id);
    if (result) results[id] = result;
  }
  return results;
}

export function writeLastResult(id: ModuleId, result: LastResult) {
  write(id, JSON.stringify(result));
}

export function readLastVisited(): ModuleId | undefined {
  const value = read('last-visited');
  return moduleIds.find((id) => id === value);
}

export function writeLastVisited(id: ModuleId) {
  write('last-visited', id);
}
