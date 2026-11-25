// Discovery fixture only: the final RNG/distribution contracts belong to #13.
export const ENGINE_VERSION = 'simulation-fixture-v1';
export const RNG_VERSION = 'fixture-mix32-v1';
export const LIMITS = Object.freeze({ maxDraws: 2_000_000, maxRetainedMeans: 256, maxPrefixes: 64, workerBatch: 2048 });
export const THEORY = Object.freeze({ uniform: { mean: 0.5, variance: 1 / 12 }, exponential: { mean: 1, variance: 1 } });

export class SimulationError extends Error {
  constructor(code, message) { super(message); this.name = 'SimulationError'; this.code = code; }
}
const fail = (code, message) => { throw new SimulationError(code, message); };
const integer = (x, min, max, field) => {
  if (!Number.isSafeInteger(x) || x < min || x > max) fail('INVALID_INPUT', `${field} must be an integer in [${min}, ${max}]`);
  return x;
};

export function validateSpec(input) {
  if (!input || typeof input !== 'object') fail('INVALID_INPUT', 'A specification is required');
  if ((input.engineVersion ?? ENGINE_VERSION) !== ENGINE_VERSION || (input.rngVersion ?? RNG_VERSION) !== RNG_VERSION) fail('UNSUPPORTED_VERSION', 'Replay requires compatible fixture versions');
  if (!['lln', 'clt'].includes(input.experiment) || !THEORY[input.model]) fail('INVALID_INPUT', 'Unknown experiment or fixture model');
  const seed = integer(input.seed, 0, 0xffffffff, 'seed');
  const n = integer(input.n, 1, LIMITS.maxDraws, 'n');
  const repetitions = integer(input.repetitions ?? 1, 1, LIMITS.maxDraws, 'repetitions');
  if (input.experiment === 'lln' && repetitions !== 1) fail('INVALID_INPUT', 'LLN uses one trajectory');
  if (n * repetitions > LIMITS.maxDraws) fail('RESOURCE_LIMIT', 'The fixture is capped at two million draws');
  const retain = integer(input.retain ?? 256, 0, LIMITS.maxRetainedMeans, 'retain');
  let prefixNs = [];
  if (input.experiment === 'lln') {
    if (input.prefixNs !== undefined) {
      if (!Array.isArray(input.prefixNs) || input.prefixNs.length === 0 || input.prefixNs.length > LIMITS.maxPrefixes) fail('INVALID_INPUT', 'Invalid checkpoint list');
      prefixNs = [...input.prefixNs];
      prefixNs.forEach((k, i) => { integer(k, 1, n, 'prefix n'); if (i && k <= prefixNs[i - 1]) fail('INVALID_INPUT', 'Checkpoints must increase'); });
    } else {
      for (let k = 1; k < n; k *= 2) prefixNs.push(k);
      prefixNs.push(n);
    }
  }
  return Object.freeze({ experiment: input.experiment, model: input.model, seed, n, repetitions, retain, prefixNs: Object.freeze(prefixNs), engineVersion: ENGINE_VERSION, rngVersion: RNG_VERSION });
}

function mix32(x) {
  x = Math.imul(x ^ x >>> 16, 0x7feb352d);
  x = Math.imul(x ^ x >>> 15, 0x846ca68b);
  return (x ^ x >>> 16) >>> 0;
}
export function fixtureUint32(seed, stream, index, namespace = 0) {
  return mix32(seed ^ mix32(stream + 0x9e3779b9) ^ mix32(index + 0x85ebca6b) ^ namespace);
}
export function fixtureDraw(spec, stream, index) {
  const u = (fixtureUint32(spec.seed, stream, index, spec.experiment === 'lln' ? 0x51a7 : 0xc17) + 0.5) / 2 ** 32;
  return spec.model === 'uniform' ? u : -Math.log1p(-u);
}

export function createEngine(input, drawOverride) {
  const spec = validateSpec(input);
  return {
    spec, draw: drawOverride || ((stream, index) => fixtureDraw(spec, stream, index)),
    processed: 0, completed: 0, index: 0, mean: 0, m2: 0, replicateMean: 0, replicateM2: 0,
    means: new Float64Array(spec.experiment === 'clt' ? Math.min(spec.repetitions, spec.retain) : 0),
    prefixN: new Uint32Array(spec.prefixNs.length), prefixMean: new Float64Array(spec.prefixNs.length), prefixCount: 0,
    histogram: new Uint32Array(spec.experiment === 'clt' ? 16 : 0), underflow: 0, overflow: 0, done: false,
  };
}
export const retainedBytes = state => state ? state.means.byteLength + state.prefixN.byteLength + state.prefixMean.byteLength + state.histogram.byteLength : 0;

export function advance(state, budget = 2048, deadline = Infinity) {
  integer(budget, 1, LIMITS.maxDraws, 'batch budget');
  const { spec } = state;
  let slice = 0;
  while (!state.done && slice < budget) {
    if (slice && slice % 64 === 0 && performance.now() >= deadline) break;
    const stream = spec.experiment === 'lln' ? 0 : state.completed + 1;
    const value = state.draw(stream, state.index, spec);
    if (!Number.isFinite(value)) fail('NONFINITE_DRAW', 'A fixture draw was nonfinite');
    state.index++; state.processed++; slice++;
    const delta = value - state.replicateMean;
    state.replicateMean += delta / state.index;
    state.replicateM2 += delta * (value - state.replicateMean);
    if (spec.experiment === 'lln' && state.index === spec.prefixNs[state.prefixCount]) {
      state.prefixN[state.prefixCount] = state.index;
      state.prefixMean[state.prefixCount++] = state.replicateMean;
    }
    if (state.index === spec.n) {
      if (spec.experiment === 'lln') {
        state.mean = state.replicateMean; state.m2 = state.replicateM2; state.completed = 1;
      } else {
        if (state.completed < state.means.length) state.means[state.completed] = state.replicateMean;
        state.completed++;
        const d = state.replicateMean - state.mean;
        state.mean += d / state.completed;
        state.m2 += d * (state.replicateMean - state.mean);
        const theory = THEORY[spec.model];
        const z = (state.replicateMean - theory.mean) / Math.sqrt(theory.variance / spec.n);
        if (z < -4) state.underflow++;
        else if (z > 4) state.overflow++;
        else state.histogram[Math.min(15, Math.floor((z + 4) / 0.5))]++;
      }
      if (state.completed === spec.repetitions) state.done = true;
      else { state.index = 0; state.replicateMean = 0; state.replicateM2 = 0; }
    }
  }
  return state.done;
}

export function finish(state) {
  if (!state.done) fail('INCOMPLETE', 'Only completed runs can be committed');
  const s = state.spec, count = s.experiment === 'lln' ? s.n : s.repetitions;
  return {
    engineVersion: ENGINE_VERSION, rngVersion: RNG_VERSION, spec: s,
    processed: state.processed, repetitions: s.repetitions, mean: state.mean,
    sampleVariance: count > 1 ? state.m2 / (count - 1) : null,
    theory: { ...THEORY[s.model], varianceOfMean: THEORY[s.model].variance / s.n },
    prefixN: state.prefixN.subarray(0, state.prefixCount), prefixMean: state.prefixMean.subarray(0, state.prefixCount),
    means: state.means,
    histogram: { zMin: -4, binWidth: 0.5, counts: state.histogram, underflow: state.underflow, overflow: state.overflow },
    retention: { policy: 'first-k-means-and-complete-summary', rawDraws: 0, numericBytes: retainedBytes(state) },
  };
}
export function transferBuffers(result) {
  return [...new Set([result.prefixN.buffer, result.prefixMean.buffer, result.means.buffer, result.histogram.counts.buffer])].filter(buffer => buffer.byteLength);
}
export const canonical = result => JSON.stringify(result, (_key, value) => ArrayBuffer.isView(value) ? Array.from(value) : value);
