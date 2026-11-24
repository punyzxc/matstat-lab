import test from 'node:test';
import assert from 'node:assert/strict';
import { project, quadsByDepth, niceTicks, lerpGrid, easeOutCubic, unit } from '../src/stations/surface-math.mjs';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const vp = { cx: 100, cy: 50, scale: 10 };

test('yaw=0, pitch=0 maps x to screen x and z to screen up', () => {
  const p = project([2, 3, 4], { yaw: 0, pitch: 0 }, vp);
  near(p.x, 120);
  near(p.y, 50 - 40);
  near(p.depth, 3);
});

test('yaw of a quarter turn sends +x into the screen', () => {
  const p = project([1, 0, 0], { yaw: Math.PI / 2, pitch: 0 }, vp);
  near(p.x, 100);
  near(p.depth, 1);
});

test('pitch of a quarter turn looks straight down: far y goes up the screen, z becomes depth', () => {
  const a = project([0, 1, 0], { yaw: 0, pitch: Math.PI / 2 }, vp);
  near(a.x, 100);
  near(a.y, 40);
  near(a.depth, 0);
  const b = project([0, 0, 1], { yaw: 0, pitch: Math.PI / 2 }, vp);
  near(b.y, 50);
  near(b.depth, -1);
});

test('rotation preserves distance from the origin', () => {
  const p = project([0.3, -0.7, 0.5], { yaw: 0.9, pitch: 0.4 });
  near(Math.hypot(p.x, p.y, p.depth), Math.hypot(0.3, 0.7, 0.5));
});

test('quadsByDepth draws far first and keeps input order on ties', () => {
  const sq = (y) => ({ points: [[0, y, 0], [1, y, 0], [1, y, 1], [0, y, 1]], y });
  const order = quadsByDepth([sq(-1), sq(2), sq(0)], { yaw: 0, pitch: 0 }, vp).map((q) => q.item.y);
  assert.deepEqual(order, [2, 0, -1]);
  const tie = quadsByDepth([{ points: [[0, 1, 0]], id: 'a' }, { points: [[5, 1, 0]], id: 'b' }], {}, vp);
  assert.deepEqual(tie.map((q) => q.item.id), ['a', 'b']);
  const biased = quadsByDepth([{ points: [[0, 1, 0]], bias: 0.1, id: 'near' }, { points: [[0, 1, 0]], id: 'plain' }], {}, vp);
  assert.deepEqual(biased.map((q) => q.item.id), ['plain', 'near']);
});

test('depth order follows the view: after a half turn the order reverses', () => {
  const items = [{ points: [[0, -1, 0]], id: 'a' }, { points: [[0, 1, 0]], id: 'b' }];
  assert.deepEqual(quadsByDepth(items, { yaw: 0, pitch: 0 }).map((q) => q.item.id), ['b', 'a']);
  assert.deepEqual(quadsByDepth(items, { yaw: Math.PI, pitch: 0 }).map((q) => q.item.id), ['a', 'b']);
});

test('niceTicks stay inside the range on a 1-2-2.5-5 grid', () => {
  assert.deepEqual(niceTicks(0, 1, 5), [0, 0.2, 0.4, 0.6, 0.8, 1]);
  assert.deepEqual(niceTicks(-3, 3, 3), [-2, 0, 2]);
  assert.deepEqual(niceTicks(2, 2), [2]);
});

test('tween helpers', () => {
  assert.deepEqual(lerpGrid([[0, 2]], [[2, 4]], 0.5), [[1, 3]]);
  near(easeOutCubic(0), 0);
  near(easeOutCubic(1), 1);
  assert.ok(easeOutCubic(0.5) > 0.5);
  near(unit(5, 0, 10), 0);
});
