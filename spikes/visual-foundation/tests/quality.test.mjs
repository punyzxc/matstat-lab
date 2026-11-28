import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseQuality, createFrameMonitor, qualityLevels, renderStride } from '../src/quality.ts';

const desktop = { cores: 8, memory: 8, coarse: false, pixelArea: 2_000_000, saveData: false };

test('quality selection uses CPU, memory, pointer, backing size and data preference', () => {
  for (const [signal, level] of [
    [{}, 'high'],
    [{ cores: 4 }, 'medium'],
    [{ memory: 4 }, 'medium'],
    [{ coarse: true }, 'medium'],
    [{ pixelArea: 7_000_000 }, 'medium'],
    [{ cores: 2 }, 'low'],
    [{ memory: 2 }, 'low'],
    [{ saveData: true }, 'low'],
    [{ memory: undefined, cores: undefined }, 'high'],
  ]) {
    assert.equal(chooseQuality({ ...desktop, ...signal }).level, level);
  }
  assert.equal(qualityLevels.low.dprCap, 1);
  assert.ok(qualityLevels.low.frameMs >= 33);
  assert.equal(qualityLevels.low.blur, false);
  assert.equal(renderStride(qualityLevels.high.particleScale), 1);
  assert.ok(renderStride(qualityLevels.low.particleScale) > 1);
});

test('the frame monitor uses a full three-second median, ignoring an isolated stall', () => {
  const monitor = createFrameMonitor();
  assert.equal(monitor.sample(0), undefined);
  for (let now = 16; now < 1000; now += 16) assert.equal(monitor.sample(now), undefined);
  for (let now = 1300; now < 3000; now += 16) assert.equal(monitor.sample(now), undefined);
  assert.equal(monitor.sample(3000), 16);
});

test('a reset drops frame times from before a hidden tab', () => {
  const monitor = createFrameMonitor();
  monitor.sample(0);
  monitor.sample(42);
  monitor.reset();
  assert.equal(monitor.sample(5000), undefined);
  for (let now = 5040; now < 8000; now += 40) assert.equal(monitor.sample(now), undefined);
  assert.equal(monitor.sample(8000), 40);
});
