import { composeDecor, createMotionLoop, drawGlyphSprite, randomSource } from './model.mjs';
import { syntheticSnapshots } from './fixtures.mjs';

const $ = selector => document.querySelector(selector);
const scene = $('.scene'), zone = $('.globe-zone'), canvas = $('#atmosphere');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const baseline = params.get('baseline') === '1';
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const seed = 2048;
const requestedTime = Number(params.get('time'));
let userPaused = params.get('paused') === '1', width = 0, height = 0, dpr = 1;
let yaw = 0, zoom = 1, sphere = null, sphereKey = '', geometry, reserved = [];
let renderCount = 0, lastMetrics = 0, previousFrame = null, currentPlan, drawCalls = 0;
const durations = [], intervals = [], errors = [];
addEventListener('error', event => errors.push(event.message));

function measure() {
  const bounds = scene.getBoundingClientRect(), area = zone.getBoundingClientRect();
  width = bounds.width; height = bounds.height; dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  geometry = { x: area.left - bounds.left, y: area.top - bounds.top, width: area.width, height: area.height };
  geometry.cx = geometry.x + geometry.width / 2;
  geometry.cy = geometry.y + geometry.height * 0.5;
  geometry.radius = Math.min(geometry.width * 0.39, geometry.height * 0.39) * zoom;
  reserved = [...scene.querySelectorAll('[data-reserved]')].map(el => {
    const r = el.getBoundingClientRect();
    return { x: r.left - bounds.left - 8, y: r.top - bounds.top - 8, width: r.width + 16, height: r.height + 16 };
  });
  loop.invalidate();
}

function globeTexture(radius) {
  const key = `${Math.round(radius)}-${yaw}-${dpr}`;
  if (key === sphereKey) return sphere;
  sphereKey = key;
  const size = Math.ceil(radius * 2 + 8), r = radius;
  sphere = document.createElement('canvas'); sphere.width = Math.ceil(size * dpr); sphere.height = Math.ceil(size * dpr);
  const g = sphere.getContext('2d'); g.scale(dpr, dpr); g.translate(size / 2, size / 2);
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fillStyle = '#101410'; g.fill();
  g.strokeStyle = '#414b3b'; g.lineWidth = 0.7; g.stroke();
  const rad = Math.PI / 180;
  const point = (lat, lon) => ({ x: r * Math.cos(lat * rad) * Math.sin(lon * rad), y: -r * Math.sin(lat * rad), front: Math.cos(lon * rad) >= 0 });
  g.strokeStyle = '#2a3427'; g.lineWidth = 0.5;
  for (let latitude = -60; latitude <= 60; latitude += 30) {
    g.beginPath();
    for (let lon = -90; lon <= 90; lon += 3) { const p = point(latitude, lon); if (lon === -90) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y); }
    g.stroke();
  }
  for (let lon = -75; lon <= 75; lon += 30) {
    g.beginPath();
    for (let lat = -90; lat <= 90; lat += 3) { const p = point(lat, lon); if (lat === -90) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y); }
    g.stroke();
  }
  // Elliptical land patches are deliberately synthetic, not a geographic dataset.
  const ellipses = [[-100, 42, 40, 24], [-65, -14, 18, 37], [12, 48, 31, 18], [20, 3, 26, 34], [77, 37, 53, 24], [130, -25, 23, 16]];
  g.font = `${Math.max(3.5, r * 0.025)}px "Courier New",monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let lat = -75; lat < 80; lat += 3) for (let lon = -87; lon < 90; lon += 3) {
    let world = ((lon + yaw + 200) % 360 + 360) % 360 - 180;
    const land = ellipses.some(([x, y, a, b]) => ((world - x) / a) ** 2 + ((lat - y) / b) ** 2 < 1);
    if (!land) continue;
    const p = point(lat, lon), light = Math.cos(lon * rad) * 0.5 + 0.35;
    g.fillStyle = `rgba(210,222,198,${light})`;
    g.fillText((Math.round(lat + lon) % 4) ? ':' : '+', p.x, p.y);
  }
  return sphere;
}

const primitive = (method, ...args) => { drawCalls++; ctx[method](...args); };
function drawFrame(time) {
  if (!geometry) return;
  const start = performance.now();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1; drawCalls = 0; primitive('clearRect', 0, 0, width, height);
  currentPlan = composeDecor({ width, height, seed, reserved, projections: syntheticSnapshots(time, geometry), time, decorRegion: geometry });
  if (baseline) currentPlan = { stars: [], satellites: [], illustrations: [], beacons: [] };
  ctx.fillStyle = '#c7d0bd'; ctx.strokeStyle = '#c7d0bd'; ctx.lineWidth = 0.6;
  for (const star of currentPlan.stars) {
    ctx.globalAlpha = 0.13 + (star.cross ? 0.1 : 0) + 0.06 * (1 + Math.sin(time * 0.35 + star.phase));
    if (star.cross) { ctx.beginPath(); ctx.moveTo(star.x - 2, star.y); ctx.lineTo(star.x + 2, star.y); ctx.moveTo(star.x, star.y - 2); ctx.lineTo(star.x, star.y + 2); primitive('stroke'); }
    else primitive('fillRect', star.x, star.y, 1, 1);
  }
  for (const ornament of currentPlan.illustrations) drawCalls += drawGlyphSprite(ctx, ornament);
  for (const sprite of currentPlan.satellites.filter(s => s.layer === 'rear')) drawCalls += drawGlyphSprite(ctx, sprite);
  ctx.globalAlpha = 1;
  const image = globeTexture(geometry.radius), size = image.width / dpr;
  primitive('drawImage', image, geometry.cx - size / 2, geometry.cy - size / 2, size, size);
  for (const sprite of currentPlan.satellites.filter(s => s.layer === 'front')) drawCalls += drawGlyphSprite(ctx, sprite);
  for (const beacon of currentPlan.beacons) {
    ctx.globalAlpha = beacon.opacity; ctx.strokeStyle = '#ced8c2'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(beacon.x, beacon.y, 3, 0, Math.PI * 2); primitive('stroke');
    ctx.fillStyle = '#d5dec9'; primitive('fillRect', beacon.x - 0.5, beacon.y - 0.5, 1, 1);
  }
  ctx.globalAlpha = 1; renderCount++;
  const now = performance.now();
  if (loop.snapshot().active) {
    durations.push(now - start);
    if (previousFrame !== null) intervals.push(now - previousFrame);
    previousFrame = now;
    if (durations.length > 360) durations.shift();
    if (intervals.length > 360) intervals.shift();
  }
  if (now - lastMetrics > 500 || !loop.snapshot().active) { updateMetrics(); lastMetrics = now; }
}

const loop = createMotionLoop({ request: cb => requestAnimationFrame(cb), cancel: id => cancelAnimationFrame(id), draw: drawFrame, initialTime: Number.isFinite(requestedTime) ? requestedTime : 0 });
const percentile = (values, p) => values.length ? [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))] : null;
function snapshot() {
  const state = loop.snapshot();
  return {
    ...state, seed, baseline, width, height, dpr, yaw, zoom, renderCount, drawCalls, errors: [...errors],
    counts: currentPlan ? Object.fromEntries(Object.entries(currentPlan).map(([k, v]) => [k, v.length])) : {},
    satelliteKinds: currentPlan?.satellites.map(s => s.kind) || [],
    cpuMs: { samples: durations.length, median: percentile(durations, 0.5), p95: percentile(durations, 0.95), max: durations.length ? Math.max(...durations) : null },
    cadenceMs: { samples: intervals.length, median: percentile(intervals, 0.5), p95: percentile(intervals, 0.95) },
    domNodes: scene.querySelectorAll('*').length,
    sceneBounds: { x: scene.getBoundingClientRect().x, y: scene.getBoundingClientRect().y },
    reserved: reserved.map(r => ({ ...r })),
    decorations: currentPlan ? Object.entries(currentPlan).flatMap(([kind, values]) => values.map(v => ({ kind, bounds: v.bounds }))) : [],
  };
}
function updateMetrics() {
  const s = snapshot(), counts = s.counts;
  $('#motion-state').textContent = s.hidden ? 'Hidden / stopped' : s.reduced ? 'Reduced motion / static' : s.paused ? 'Paused / static' : 'Decorating at ≤30 fps';
  $('#objects').textContent = `${counts.stars || 0} stars · ${counts.satellites || 0} craft · ${counts.beacons || 0} lamps`;
  $('#nodes').textContent = `1 visible / ${s.domNodes} scene nodes`;
  $('#timing').textContent = s.cpuMs.samples > 2 ? `${s.cpuMs.median.toFixed(2)} ms / ${s.cadenceMs.median?.toFixed(1) || '—'} ms` : 'Static / awaiting samples';
  $('#pause').setAttribute('aria-pressed', String(userPaused));
  $('#pause').textContent = userPaused ? 'Resume atmosphere' : 'Pause atmosphere';
}
function policy() {
  previousFrame = null;
  loop.setFlags({ paused: userPaused, reduced: motion.matches, hidden: document.visibilityState === 'hidden' });
  updateMetrics();
}

$('#pause').addEventListener('click', () => { userPaused = !userPaused; policy(); });
$('#rotate').addEventListener('click', () => { yaw = (yaw + 45) % 360; loop.invalidate(); });
$('#zoom-in').addEventListener('click', () => { zoom = Math.min(1.1, zoom + 0.1); measure(); });
$('#zoom-out').addEventListener('click', () => { zoom = Math.max(0.75, zoom - 0.1); measure(); });
for (const link of document.querySelectorAll('[data-module]')) link.addEventListener('click', () => {
  document.querySelector('.instrument.selected')?.classList.remove('selected'); link.classList.add('selected');
  $('#selected-instrument').textContent = link.dataset.module;
});
let sampleSeed = seed;
function resample() {
  const random = randomSource(sampleSeed++);
  const mean = Array.from({ length: 512 }, () => random()).reduce((a, b) => a + b, 0) / 512;
  $('#sample-mean').value = mean.toFixed(3);
  for (const readout of document.querySelectorAll('[data-mean]')) readout.textContent = mean.toFixed(3);
}
$('#resample').addEventListener('click', resample);
motion.addEventListener('change', policy);
document.addEventListener('visibilitychange', policy);
addEventListener('pagehide', () => loop.setFlags({ hidden: true }));
addEventListener('pageshow', policy);
const resize = new ResizeObserver(measure); resize.observe(scene);
Object.defineProperty(window, 'atmosphereStudy', { value: Object.freeze({ snapshot }), writable: false });
resample(); measure(); policy();
