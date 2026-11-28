// Bounded discovery fixture; deterministic streams are not a PRNG certification.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createEngine, advance, finish, canonical, ENGINE_VERSION, RNG_VERSION} from '../simulation-engine/engine.mjs';
const dir = new URL('.',import.meta.url);
const read = name => readFileSync(new URL(name,dir));
const hash = data => createHash('sha256').update(data).digest('hex');
const planBytes = () => read('plan.json');
export function validateInputs(plan, refs) {
  if (!refs || plan.engineVersion !== ENGINE_VERSION || plan.rngVersion !== RNG_VERSION || plan.studyVersion !== 'convergence-teaching-v1') throw Error('Missing reference or unsupported version');
  if (hash(planBytes()) !== refs.planSha256 || JSON.stringify(JSON.parse(planBytes())) !== JSON.stringify(plan) || refs.studyVersion !== plan.studyVersion) throw Error('Plan provenance mismatch');
  if (JSON.stringify(JSON.parse(read('references.json'))) !== JSON.stringify(refs)) throw Error('Reference input differs from file');
  try { execFileSync('python3',['reference.py','--check'],{cwd:dir,stdio:'pipe'}); } catch { throw Error('Independent reference regeneration failed'); }
  if (plan.familyEvents !== plan.models.length*plan.seeds.length*(plan.prefixNs.length+plan.cltNs.length) || plan.familyEvents !== 84) throw Error('Family event mismatch');
  if (JSON.stringify(plan.zEdges) !== JSON.stringify(Array.from({length:17},(_,i)=>-4+i*0.5))) throw Error('Histogram grid mismatch');
}
export function histogramCDF(h) {
  let count=h.underflow; const out=[count];
  for (const bin of h.counts) { count += bin; out.push(count); }
  return out;
}
function simulate(spec,budgets) {
  let baseline, payload;
  for (const budget of budgets) {
    const state=createEngine(spec); while (!advance(state,budget)) {} const result=finish(state), current=canonical(result);
    if (baseline !== undefined && baseline !== current) throw Error('Canonical replay mismatch');
    baseline=current; payload=result;
  }
  return {result:payload, scientificPayloadSha256:hash(baseline)};
}
const distance=(a,b)=>Math.max(...a.map((x,i)=>Math.abs(x-b[i])));
export function generate(plan,refs) {
  validateInputs(plan,refs);
  const lln=[], clt=[];
  for (const model of plan.models) for (const seed of plan.seeds) {
    const theory=refs.models[model];
    const lspec={experiment:'lln',model,seed,n:Math.max(...plan.prefixNs),repetitions:1,retain:0,prefixNs:plan.prefixNs,engineVersion:plan.engineVersion,rngVersion:plan.rngVersion};
    const lr=simulate(lspec,plan.replayBudgets), l=lr.result;
    lln.push({spec:lspec,scientificPayloadSha256:lr.scientificPayloadSha256,idealMean:theory.mean,idealVariance:theory.variance,prefixes:Array.from(l.prefixN,(n,i)=>{const mean=l.prefixMean[i],band=theory.llnBands[n];return {n,mean,band,pass:mean>=band[0]&&mean<=band[1]};})});
    for (const n of plan.cltNs) {
      const spec={experiment:'clt',model,seed,n,repetitions:plan.repetitions,retain:plan.retainedMeans,engineVersion:plan.engineVersion,rngVersion:plan.rngVersion};
      const cr=simulate(spec,plan.replayBudgets), r=cr.result, h=r.histogram, counts=histogramCDF(h), empiricalCDF=counts.map(x=>x/plan.repetitions), finite=theory.clt[n].finiteCDF, phi=refs.phi;
      if (h.underflow+h.overflow+Array.from(h.counts).reduce((a,b)=>a+b,0)!==plan.repetitions) throw Error('Histogram does not conserve repetitions');
      const modelDistance=distance(empiricalCDF,finite), normalDistance=distance(empiricalCDF,phi);
      clt.push({spec,scientificPayloadSha256:cr.scientificPayloadSha256,idealMean:theory.mean,idealVariance:theory.variance,idealVarianceOfMean:theory.variance/n,observedMean:r.mean,observedVariance:r.sampleVariance,histogram:{underflow:h.underflow,bins:Array.from(h.counts),overflow:h.overflow},cdfCounts:counts,empiricalCDF,idealFiniteNCDF:finite,phi,gridDistanceToModel:modelDistance,gridDistanceToPhi:normalDistance,finiteModelVsPhiBias:distance(finite,phi),epsilon:refs.epsilon,modelBandPass:modelDistance<=refs.epsilon,normalBandCompatible:normalDistance<=refs.epsilon});
    }
  }
  return {studyVersion:plan.studyVersion,provenance:{planSha256:hash(planBytes()),referenceSha256:hash(read('references.json')),referenceGeneratorSha256:hash(read('reference.py')),generatorSha256:hash(read('run.mjs')),engineSha256:hash(read('../simulation-engine/engine.mjs')),node:process.version,v8:process.versions.v8,referenceVersions:refs.versions},familyEvents:plan.familyEvents,deltaPerEvent:refs.deltaPerEvent,replayBudgets:plan.replayBudgets,replayCases:lln.length+clt.length,zEdges:plan.zEdges,cdfSemantics:'Underflow counts z < -4; internal edge counts z < edge; final edge includes z = 4. Histogram grid distance is not a full KS statistic.',lln,clt};
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args=process.argv.slice(2); if (args.length>1 || ![undefined,'--write','--check'].includes(args[0])) throw Error('Usage: node run.mjs [--write|--check]');
  const output=JSON.stringify(generate(JSON.parse(planBytes()),JSON.parse(read('references.json'))),null,2)+'\n';
  if (args[0]==='--check') { if (read('results.json').toString()!==output) throw Error('Results regeneration differs'); console.log('Results regeneration matches'); }
  else {writeFileSync(new URL('results.json',dir),output); console.log('Wrote results.json');}
}
