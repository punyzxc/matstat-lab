import test from 'node:test';
import assert from 'node:assert/strict';
import { createStars, composeDecor, createMotionLoop, drawGlyphSprite, GLYPHS } from './model.mjs';

test('AC1: a seeded star field is reproducible, bounded, and changes with the seed', () => {
  const a = createStars(2048, 144);
  assert.deepEqual(a, createStars(2048, 144));
  assert.notDeepEqual(a, createStars(2049, 144));
  assert.equal(a.length, 144);
  assert.ok(a.every(p => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1));
  assert.ok(new Set(a.map(p => p.x)).size > 100);
});

test('AC1: distinct sample craft draw only neutral glyphs without rectangular backdrops', () => {
  assert.notDeepEqual(GLYPHS.array, GLYPHS.relay);
  for (const kind of ['array', 'relay']) {
    const calls = [];
    const ctx = new Proxy({ save() {}, restore() {}, fillText: (...args) => calls.push(['text', ...args]) }, {
      get(target, key) { return key in target ? target[key] : (...args) => calls.push([key, ...args]); },
    });
    drawGlyphSprite(ctx, { kind, x: 100, y: 80, font: 9, opacity: 0.8 });
    assert.ok(calls.filter(c => c[0] === 'text').length >= 3);
    assert.ok(calls.filter(c => c[0] === 'text').every(c => /^[\x20-\x7e]+$/.test(c[1])));
    assert.equal(calls.filter(c => ['fillRect', 'clearRect', 'fill', 'strokeRect'].includes(c[0])).length, 0);
  }
});

test('AC1/AC3: consume visibility fixtures and keep every decoration clear of reserved UI', () => {
  for (const width of [390, 1440]) {
    const height = 800;
    const reserved = [{ x: 0, y: 0, width: width / 3, height: 180 }];
    const projections = [
      { id: 'blocked', kind: 'array', x: 30, y: 30, depth: 1, visible: true },
      { id: 'front', kind: 'relay', x: width * 0.7, y: 300, depth: 1, visible: true },
      { id: 'rear', kind: 'array', x: width * 0.5, y: 500, depth: -1, visible: true },
      { id: 'occluded', kind: 'relay', x: width * 0.7, y: 400, depth: -1, visible: false },
    ];
    const plan = composeDecor({ width, height, seed: 2048, reserved, projections, time: 4 });
    assert.deepEqual(plan.satellites.map(s => s.id).sort(), ['front', 'rear']);
    assert.equal(plan.satellites.find(s => s.id === 'rear').layer, 'rear');
    assert.equal(plan.satellites.find(s => s.id === 'front').layer, 'front');
    assert.equal(plan.beacons.length, 2);
    assert.ok(plan.illustrations.length >= 1);
    for (const item of [...plan.stars, ...plan.satellites, ...plan.beacons, ...plan.illustrations]) {
      const b = item.bounds;
      assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= width && b.y + b.height <= height);
      assert.ok(reserved.every(r => b.x >= r.x + r.width || b.x + b.width <= r.x || b.y >= r.y + r.height || b.y + b.height <= r.y));
    }
  }
});

test('AC2: pause, reduced motion, and hidden state cancel callbacks without accumulated hidden time', () => {
  let next = 1;
  const pending = new Map();
  const draws = [];
  const loop = createMotionLoop({
    request: cb => { const id = next++; pending.set(id, cb); return id; },
    cancel: id => pending.delete(id),
    draw: time => draws.push(time),
  });
  const step = timestamp => { const [id, cb] = [...pending][0]; pending.delete(id); cb(timestamp); };
  loop.setFlags({ paused: false, reduced: false, hidden: false });
  assert.equal(pending.size, 1);
  step(0); step(40);
  assert.ok(loop.snapshot().time > 0);
  for (const flag of ['paused', 'reduced', 'hidden']) {
    const before = loop.snapshot().time;
    loop.setFlags({ [flag]: true });
    assert.equal(pending.size, 0, flag);
    loop.invalidate();
    assert.equal(pending.size, 0, 'manual redraw must not restart decoration');
    assert.equal(loop.snapshot().time, before);
    loop.setFlags({ [flag]: false });
    assert.equal(pending.size, 1);
    step(1_000_000);
    assert.equal(loop.snapshot().time, before, 'resume must reset the timestamp');
  }
  loop.dispose();
  assert.equal(pending.size, 0);
  assert.ok(draws.length > 0);
});
