// Discovery evidence only. --check never rewrites expectations or teaching scripts.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ENGINE_VERSION, RNG_VERSION } from '../simulation-engine/engine.mjs';

const root = new URL('../../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const catalog = read('spikes/visual-foundation/src/stations/catalog.ts');
const kernels = Object.fromEntries([...catalog.matchAll(/kind: 'kernel', id: '([^']+)'[^\n]*kernel: '([^']+)'/g)].map(m => [m[1], m[2]]));
const source = JSON.parse(read('spikes/lecture-worked-examples-audit/fixtures/source-manifest.json'));
const evidence = {
  study: 'lecture-walkthroughs-random-variables-v1',
  baseCommit: 'cde1c2385b59c7b1e7b6222c129ef8a3fc238681',
  sourceCommit: source.source_commit,
  sourceManifestSha256: sha(read('spikes/lecture-worked-examples-audit/fixtures/source-manifest.json')),
  node: process.version, engineVersion: ENGINE_VERSION, rngVersion: RNG_VERSION,
  catalogSha256: sha(catalog), generatorSha256: sha(readFileSync(fileURLToPath(import.meta.url))),
  scriptSha256: {}, kernelSha256: {}, presets: {},
};
for (let lecture=4; lecture<=9; lecture++) {
  const path = `spikes/lecture-walkthroughs-random-variables/scripts/L0${lecture}.json`;
  const raw = read(path);
  evidence.scriptSha256[`L0${lecture}`] = sha(raw);
  const script = JSON.parse(raw);
  for (const step of script.steps) {
    if (!step.experiment) continue;
    const experiment = step.experiment;
    const kernel = kernels[experiment.station];
    if (!kernel) throw Error(`${step.id}: a proposed link must target an available pure kernel`);
    const path = `spikes/${kernel}/kernel.mjs`;
    const mod = await import(new URL(path, root));
    const api = mod.default ?? mod;
    const declared = api.stations?.[experiment.station]?.params ?? api.meta.params;
    const params = Object.fromEntries(declared.map(p => [p.key, p.default]));
    for (const [key,value] of Object.entries(experiment.params)) {
      const p = declared.find(p => p.key===key);
      if (!p || !Number.isFinite(value) || value<p.min || value>p.max) throw Error(`${step.id}: would be clamped: ${key}=${value}`);
      const grid = (value-p.min)/p.step;
      if (Math.abs(grid-Math.round(grid))>1e-7 && value!==p.max) throw Error(`${step.id}: would snap: ${key}=${value}`);
      params[key] = value;
    }
    const options = { station: experiment.station, seed: experiment.seed };
    const result = api.run(params, options);
    const replay = api.run(params, options);
    if (JSON.stringify(result)!==JSON.stringify(replay)) throw Error(`${step.id}: nondeterministic replay`);
    evidence.kernelSha256[kernel] = sha(read(path));
    const query = new URLSearchParams({seed:String(experiment.seed),...Object.fromEntries(Object.entries(params).map(([k,v])=>[k,String(v)]))});
    evidence.presets[step.id] = { kernel, experiment, resolvedParams: params,
      route: `#station/${experiment.station}?${query}`,
      readouts: result.readouts, sha256: sha(JSON.stringify(result)) };
  }
}
const output = JSON.stringify(evidence,null,2)+'\n';
const target = new URL('evidence.json', import.meta.url);
if (process.argv.includes('--check')) {
  if (readFileSync(target,'utf8')!==output) throw Error('Evidence differs: review the source/runtime/script change; do not silently update fixtures');
  console.log(`Verified ${Object.keys(evidence.presets).length} complete seeded readout records and exact replays`);
} else if (process.argv.includes('--write')) {
  writeFileSync(target,output);
  console.log(`Recorded ${Object.keys(evidence.presets).length} presets`);
} else throw Error('Specify --write or --check');
