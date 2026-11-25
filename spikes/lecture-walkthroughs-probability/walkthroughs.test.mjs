// Discovery-only checks for #51: the lecture 1-3 walkthrough scripts against the lectures and the station kernels.
// Run from this folder: node --test walkthroughs.test.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const spikes = new URL('../', import.meta.url);
const vf = new URL('visual-foundation/', spikes);
const read = (url) => JSON.parse(readFileSync(url, 'utf8'));
const scripts = Object.fromEntries([1, 2, 3].map((n) => [n, read(new URL(`lectures/L0${n}.json`, vf))]));
const { expected } = read(new URL('./expected.json', import.meta.url));
const inventory = read(new URL('./inventory.json', import.meta.url));

/** Station id -> kernel directory, read from the catalog (kernel stations only). */
const catalog = readFileSync(new URL('src/stations/catalog.ts', vf), 'utf8');
const kernelOf = Object.fromEntries([...catalog.matchAll(/kind: 'kernel', id: '([\w-]+)'[^}]*?kernel: '([\w-]+)'/g)].map((m) => [m[1], m[2]]));
const steps = (n) => scripts[n].steps;
const kernelPath = (station) => new URL(`${kernelOf[station]}/kernel.mjs`, spikes);

test('the three scripts are marked ready and every experiment names a kernel station of the catalog', () => {
  for (const n of [1, 2, 3]) {
    assert.equal(scripts[n].status, 'ready', `L${n}`);
    for (const s of steps(n)) if (s.experiment) assert.ok(kernelOf[s.experiment.station], `L${n} "${s.title}": ${s.experiment.station}`);
  }
});

test('AC1: every numbered formula (1)-(20) sits in the step the inventory names; every item has a step or a reason', () => {
  for (const [num, [lecture, step]] of Object.entries(inventory.formulas)) {
    const lines = steps(lecture)[step - 1]?.formula ?? [];
    assert.ok(lines.some((l) => l.includes(`(${num})`)), `formula (${num}) in L${lecture} step ${step}`);
  }
  assert.deepEqual(Object.keys(inventory.formulas).map(Number), Array.from({ length: 20 }, (_, i) => i + 1));
  for (const it of inventory.items) {
    if ('skipped' in it) { assert.ok(it.skipped.length > 20, `reason for ${it.item}`); continue; }
    assert.ok(steps(it.lecture)[it.step - 1], `L${it.lecture} step ${it.step} for ${it.item}`);
  }
  // Every content step is claimed by the inventory (the closing "Check yourself" steps are extra).
  for (const n of [1, 2, 3]) {
    const claimed = new Set(inventory.items.filter((i) => i.lecture === n && i.step).map((i) => i.step));
    steps(n).forEach((s, j) => { if (s.title !== 'Check yourself') assert.ok(claimed.has(j + 1), `L${n} step ${j + 1} "${s.title}"`); });
  }
});

test('each script ends with check questions and their answers', () => {
  for (const n of [1, 2, 3]) {
    const last = steps(n).at(-1);
    assert.equal(last.title, 'Check yourself');
    const questions = last.example.split('\n').filter((l) => /^\d\. /.test(l)).length;
    const answers = (last.notes.match(/\b\d: /g) ?? []).length;
    assert.ok(questions >= 2 && questions <= 3 && answers === questions, `L${n}: ${questions} questions, ${answers} answers`);
  }
});

test('AC3: the correctness pins give the correct value and name the lecture version', () => {
  const text = (n, i) => JSON.stringify(steps(n)[i - 1]);
  // Combinations with repetition
  assert.match(text(1, 10), /C_\{n\+k-1\}\^\{\\\\,k\}/);
  assert.match(text(1, 10), /The lecture writes \$C_\{n\+k-1\}\^\{\\\\,k-1\}\$/);
  // Bertrand: three answers, the lecture's 0.5 named and rejected
  assert.match(text(1, 18), /tfrac\{1\}\{2\}.*tfrac\{1\}\{3\}.*tfrac\{1\}\{4\}/);
  assert.match(text(1, 18), /declares 0\.5 the answer/);
  // L3 ex. 2b and the mode
  assert.match(text(3, 8), /0\.5375.*0\.5033/);
  assert.match(text(3, 5), /0\.0572.*0\.0566/);
  assert.match(text(3, 5), /mode 51/);
  // Phi conventions
  assert.match(text(3, 7), /counted from \$-\\\\infty\$/);
  assert.match(text(3, 7), /\\\\Phi_0\(x\) = \\\\Phi\(x\) - 0\.5/);
  assert.match(text(3, 7), /mathrm\{erf\}/);
  // L2 guessing student typo
  assert.match(text(2, 7), /prints \$\\\\dfrac\{p\}\{4p\+1\}\$/);
});

test('AC2: every experiment step states its readouts, and the kernel returns them for that seed and params', async (t) => {
  const covered = new Set(expected.map((e) => `${e.lecture}/${e.step}`));
  for (const n of [1, 2, 3]) steps(n).forEach((s, j) => { if (s.experiment) assert.ok(covered.has(`${n}/${j + 1}`), `L${n} step ${j + 1} has expected readouts`); });
  for (const e of expected) {
    const s = steps(e.lecture)[e.step - 1];
    assert.ok(s?.experiment, `L${e.lecture} step ${e.step} has an experiment`);
    const { station, seed, params } = s.experiment;
    if (!existsSync(kernelPath(station))) { t.diagnostic(`L${e.lecture} step ${e.step}: kernel ${kernelOf[station]} not landed yet`); continue; }
    const kernel = await import(kernelPath(station).href);
    const declared = (kernel.stations?.[station]?.params ?? kernel.meta.params).map((p) => p.key);
    for (const key of Object.keys(params ?? {})) assert.ok(declared.includes(key), `L${e.lecture} step ${e.step}: ${station} declares ${key}`);
    const out = kernel.run(params ?? {}, { seed, station });
    const twice = kernel.run(params ?? {}, { seed, station });
    assert.equal(JSON.stringify(out), JSON.stringify(twice), 'deterministic');
    for (const c of e.checks) {
      const r = out.readouts.find((x) => x.key === c.key);
      assert.ok(r, `L${e.lecture} step ${e.step}: readout ${c.key}`);
      const got = r[c.field];
      if (typeof c.value === 'number') assert.ok(Math.abs(Number(got) - c.value) <= 0.5 * 10 ** -c.digits + 1e-12, `L${e.lecture} step ${e.step}: ${c.key}.${c.field} = ${got}, stated ${c.value}`);
      else assert.equal(String(got), c.value, `L${e.lecture} step ${e.step}: ${c.key}.${c.field}`);
      if (c.shown) assert.ok(`${s.example ?? ""} ${s.notes ?? ""}`.includes(c.shown), `L${e.lecture} step ${e.step}: the step states ${c.shown}`);
    }
  }
});
