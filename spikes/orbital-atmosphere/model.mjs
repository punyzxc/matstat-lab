// Throwaway renderer study. Projection and collision-policy ownership stays with #11.
export const GLYPHS = Object.freeze({
  array: [' .---. +-+ .---. ', ' |:::|=[#]=|:::| ', " '---' +-+ '---' ", '        |        '],
  relay: ['    .-.    ', '   ( / )   ', '    \\|/    ', '   -[o]-   ', '    / \\    '],
  signal: ['     .     ', '  .  |  .  ', ' . \\ | / . ', '---- + ----', "    / \\    "],
  capsule: ['   .----.   ', ' / . .. . \\ ', '| : .  . : |', ' \\ . .. . / ', "   '----'   "],
});

export function randomSource(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ state >>> 15, state | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function createStars(seed, count) {
  const random = randomSource(seed);
  return Array.from({ length: count }, (_, i) => ({
    x: random(), y: random(), phase: random() * Math.PI * 2, cross: i % 17 === 0,
  }));
}

const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const glyphBounds = (s) => ({
  x: s.x - Math.max(...GLYPHS[s.kind].map(row => row.length)) * s.font * 0.61 / 2 - 3,
  y: s.y - GLYPHS[s.kind].length * s.font * 1.2 / 2 - 3,
  width: Math.max(...GLYPHS[s.kind].map(row => row.length)) * s.font * 0.61 + 6,
  height: GLYPHS[s.kind].length * s.font * 1.2 + 6,
});

export function composeDecor({ width, height, seed, reserved = [], projections = [], time = 0, decorRegion = { x: 0, y: 0, width, height } }) {
  const fits = b => b.x >= 0 && b.y >= 0 && b.x + b.width <= width && b.y + b.height <= height && !reserved.some(r => intersects(b, r));
  const font = width < 700 ? 7 : 9;
  const stars = createStars(seed, width < 700 ? 72 : 144).map(p => {
    const x = 5 + p.x * (width - 10), y = 5 + p.y * (height - 10);
    return { ...p, x, y, bounds: { x: x - 3, y: y - 3, width: 6, height: 6 } };
  }).filter(s => fits(s.bounds));
  const satellites = projections.filter(p => p.visible && GLYPHS[p.kind]).map(p => {
    const s = { ...p, font, opacity: (p.depth < 0 ? 0.4 : 0.82) * Math.max(0, Math.min(1, p.opacity ?? 1)), layer: p.depth < 0 ? 'rear' : 'front' };
    return { ...s, bounds: glyphBounds(s) };
  }).filter(s => fits(s.bounds));
  const illustrations = [{ kind: 'signal', u: 0.13, v: 0.54 }, { kind: 'capsule', u: 0.87, v: 0.78 }].map(p => {
    const s = { kind: p.kind, x: decorRegion.x + decorRegion.width * p.u, y: decorRegion.y + decorRegion.height * p.v, font: font * 0.85, opacity: 0.3 };
    return { ...s, bounds: glyphBounds(s) };
  }).filter(s => fits(s.bounds));
  const beacons = [{ u: 0.53, v: 0.25 }, { u: 0.72, v: 0.7 }].map((p, i) => ({
    x: decorRegion.x + decorRegion.width * p.u, y: decorRegion.y + decorRegion.height * p.v,
    opacity: 0.32 + 0.2 * (1 + Math.sin(time * Math.PI / 2 + i * Math.PI)) / 2,
    bounds: { x: decorRegion.x + decorRegion.width * p.u - 4, y: decorRegion.y + decorRegion.height * p.v - 4, width: 8, height: 8 },
  })).filter(s => fits(s.bounds));
  return { stars, satellites, illustrations, beacons };
}

export function drawGlyphSprite(ctx, sprite) {
  const art = GLYPHS[sprite.kind];
  ctx.save();
  ctx.font = `${sprite.font}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#d4d6d2';
  ctx.globalAlpha = sprite.opacity;
  art.forEach((row, i) => ctx.fillText(row, sprite.x, sprite.y + (i - art.length / 2) * sprite.font * 1.2));
  ctx.restore();
  return art.length;
}

export function createMotionLoop({ request, cancel, draw, initialTime = 0, fps = 30 }) {
  let flags = { paused: true, reduced: false, hidden: false };
  let id = null, previous = null, lastDraw = null, time = initialTime, disposed = false, callbackCount = 0;
  const active = () => !disposed && !flags.paused && !flags.reduced && !flags.hidden;
  function tick(timestamp) {
    id = null;
    if (!active()) return;
    callbackCount++;
    if (previous !== null) time += Math.max(0, Math.min((timestamp - previous) / 1000, 0.1));
    previous = timestamp;
    if (lastDraw === null || timestamp - lastDraw >= 1000 / fps - 0.25) {
      draw(time);
      lastDraw = timestamp;
    }
    id = request(tick);
  }
  return {
    setFlags(patch) {
      flags = { ...flags, ...patch };
      if (id !== null) cancel(id);
      id = null;
      previous = lastDraw = null;
      if (!disposed && !flags.hidden) draw(time);
      if (active()) id = request(tick);
    },
    invalidate() { if (!disposed && !flags.hidden) draw(time); },
    snapshot() { return { ...flags, active: active(), pendingFrame: id !== null, time, callbackCount }; },
    dispose() { disposed = true; if (id !== null) cancel(id); id = null; },
  };
}
