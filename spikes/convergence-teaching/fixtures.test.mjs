import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createEngine, advance, finish, canonical, fixtureDraw } from '../simulation-engine/engine.mjs';
import { validateInputs, histogramCDF, generate } from './run.mjs';
const dir = new URL('.', import.meta.url);
const load = name => readFileSync(new URL(name, dir));
const plan = JSON.parse(load('plan.json'));
const refs = JSON.parse(load('references.json'));
const run = (spec, budget) => { const s = createEngine(spec); while (!advance(s, budget)) {} return finish(s); };

test('family events and independent oracle anchors', () => {
  assert.equal(plan.models.length * plan.seeds.length * (plan.prefixNs.length + plan.cltNs.length), 84);
  assert.equal(plan.familyEvents, 54 + 30);
  const u = refs.models.uniform.clt['1'].finiteCDF;
  for (let i = 0; i < u.length; i++) assert.ok(Math.abs(u[i] + u[u.length - 1 - i] - 1) < 1e-12);
  assert.ok(Math.abs(refs.models.exponential.clt['1'].finiteCDF[8] - (1 - Math.exp(-1))) < 1e-12);
});
test('draw order, prefix identity and exact replay', () => {
  const spec = { experiment:'lln', model:'uniform', seed:2048, n:16, repetitions:1, retain:0, prefixNs:[1,4,16], engineVersion:plan.engineVersion, rngVersion:plan.rngVersion };
  const result = run(spec, 1); let mean = 0;
  for (let i=0; i<16; i++) { mean += (fixtureDraw(spec, 0, i) - mean)/(i+1); if ([1,4,16].includes(i+1)) assert.equal(result.prefixMean[[1,4,16].indexOf(i+1)], mean); }
  assert.equal(canonical(result), canonical(run(spec, 7)));
  assert.equal(canonical(result), canonical(run(spec, 2048)));
  const clt = {...spec, experiment:'clt', n:4, repetitions:4, retain:4, prefixNs:[]};
  const r = run(clt, 7);
  for (let k=0; k<4; k++) { let m=0; for (let i=0; i<4; i++) m+=(fixtureDraw(clt,k+1,i)-m)/(i+1); assert.equal(r.means[k],m); }
});
test('complete histogram conservation, CDF and retention invariance', () => {
  const spec={experiment:'clt',model:'exponential',seed:2048,n:4,repetitions:4096,retain:256,engineVersion:plan.engineVersion,rngVersion:plan.rngVersion};
  const r = run(spec,2048), zero = run({...spec,retain:0},2048);
  const h=r.histogram, counts=histogramCDF(h); assert.equal(h.underflow+h.overflow+Array.from(h.counts).reduce((a,b)=>a+b,0),4096);
  assert.equal(counts[0],h.underflow); assert.equal(counts[16],4096-h.overflow); assert.equal(r.means.length,256); assert.equal(zero.means.length,0);
  for (let i=0; i<16; i++) assert.equal(counts[i+1]-counts[i],h.counts[i]);
  assert.deepEqual(h,zero.histogram);
});
test('reject version and missing or altered reference provenance', () => {
  assert.throws(()=>validateInputs({...plan, engineVersion:'wrong'},refs));
  assert.throws(()=>validateInputs(plan, null));
  assert.throws(()=>validateInputs(plan,{...refs, planSha256:'bad'}));
  const changed=structuredClone(refs); changed.models.uniform.clt['1'].finiteCDF[8]=0; assert.throws(()=>validateInputs(plan,changed));
});
test('committed outputs regenerate exactly', () => {
  execFileSync('python3',['reference.py','--check'],{cwd:dir});
  assert.equal(JSON.stringify(generate(plan,refs),null,2)+'\n',load('results.json').toString());
  execFileSync('node',['run.mjs','--check'],{cwd:dir});
});
test('predeclared default exponential lesson compares n=1 with n=64', () => {
  const r=JSON.parse(load('results.json')); const cases=r.clt.filter(x=>x.spec.model==='exponential' && x.spec.seed===2048);
  assert.ok(cases.find(x=>x.spec.n===64).gridDistanceToPhi < cases.find(x=>x.spec.n===1).gridDistanceToPhi);
});
test('seed 2048 agrees with recorded #14 LLN and CLT n=32 benchmarks', () => {
  const original=JSON.parse(load('../../docs/research/assets/simulation-engine/node-evidence.json')).convergence;
  const current=JSON.parse(load('results.json'));
  for (const model of plan.models) {
    const oldL=original.find(x=>x.spec.experiment==='lln' && x.spec.model===model).result;
    const nowL=current.lln.find(x=>x.spec.model===model && x.spec.seed===2048);
    for (const p of nowL.prefixes) { const old=oldL.prefixMean[oldL.prefixN.indexOf(p.n)]; assert.ok(Math.abs(p.mean-old)<=1e-12+1e-12*Math.max(Math.abs(old),Math.abs(p.mean))); }
    const oldResult=original.find(x=>x.spec.experiment==='clt' && x.spec.model===model).result;
    const nowResult=current.clt.find(x=>x.spec.model===model && x.spec.seed===2048 && x.spec.n===32);
    const oldC=oldResult.histogram, nowC=nowResult.histogram;
    assert.deepEqual(nowC.bins,oldC.counts); assert.equal(nowC.underflow,oldC.underflow); assert.equal(nowC.overflow,oldC.overflow);
    for (const [actual,expected] of [[nowResult.observedMean,oldResult.mean],[nowResult.observedVariance,oldResult.sampleVariance]])
      assert.ok(Math.abs(actual-expected)<=1e-12+1e-12*Math.max(Math.abs(actual),Math.abs(expected)));
  }
});
