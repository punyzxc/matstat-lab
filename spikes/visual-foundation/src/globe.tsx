import type { RendererFactory } from './plate-canvas';
import { globeRadius } from './orbit-links';
import { drawSatellites, drawStars } from './orbital-atmosphere';
import landRows from './land-runs.json';

type Vector = { x: number; y: number; z: number };
type LandPoint = Vector & { tone: number; east?: LandPoint; north?: LandPoint };
export type Surface = 'points' | 'mesh';
const rad = Math.PI / 180;
const tau = Math.PI * 2;
const pitch = 18 * rad;
const tilt = -8 * rad;

function unit(lat: number, lon: number): Vector {
  const c = Math.cos(lat * rad);
  return { x: c * Math.sin(lon * rad), y: Math.sin(lat * rad), z: c * Math.cos(lon * rad) };
}

// Longitude crossings, in hundredths of a degree, from Natural Earth 1:110m land.
function buildLand() {
  const points: LandPoint[] = [];
  let previous: (LandPoint | undefined)[] = [];
  landRows.forEach((edges, row) => {
    const lat = -89.55 + row * 0.9;
    const n = Math.max(4, Math.round(400 * Math.cos(lat * rad)));
    const current = new Array<LandPoint | undefined>(n);
    let edge = 0;
    for (let j = 0; j < n; j++) {
      const lon = -180 + ((j + (row % 2) * 0.5) * 360) / n;
      while (edge < edges.length && edges[edge] <= lon * 100) edge++;
      if (edge % 2 === 0) continue;
      const point: LandPoint = { ...unit(lat, lon), tone: ((j * 31 + row * 17) % 23) / 23 };
      current[j] = point;
      if (j > 0 && current[j - 1]) current[j - 1]!.east = point;
      point.north = previous[Math.floor((j / n) * previous.length)];
      points.push(point);
    }
    previous = current;
  });
  return points;
}
const land = buildLand();
/** #195: the land as flat arrays, so the per-frame loop reads numbers, not objects. */
const LAND_N = land.length;
const landX = Float32Array.from(land, (p) => p.x);
const landY = Float32Array.from(land, (p) => p.y);
const landZ = Float32Array.from(land, (p) => p.z);
const landTone = Float32Array.from(land, (p) => p.tone);
/** Lit land squares, collected per tone level and filled with one path each (x, y, side per square). */
const byLevel = Array.from({ length: 8 }, () => ({ n: 0, v: new Float32Array(LAND_N * 3) }));

/**
 * The graticule as flat arrays, 4° between vertices (the chord of a 4° arc strays from the circle by r·(1 − cos 2°),
 * a quarter of a pixel at r = 440), drawn as one path with one stroke.
 */
const graticule: Vector[][] = [];
for (let lat = -75; lat < 90; lat += 15) {
  graticule.push(Array.from({ length: 91 }, (_, i) => unit(lat, i * 4 - 180)));
}
for (let lon = -180; lon < 180; lon += 15) {
  graticule.push(Array.from({ length: 46 }, (_, i) => unit(i * 4 - 90, lon)));
}
const gratX = Float32Array.from(graticule.flat(), (p) => p.x);
const gratY = Float32Array.from(graticule.flat(), (p) => p.y);
const gratZ = Float32Array.from(graticule.flat(), (p) => p.z);
/** Index of the first vertex of each graticule line, plus the end. */
const gratStart = graticule.reduce((a, row) => [...a, a[a.length - 1] + row.length], [0]);

const stations = [
  { code: 'LON', p: unit(51.51, -0.13) },
  { code: 'NYC', p: unit(40.71, -74.01) },
  { code: 'SAO', p: unit(-23.55, -46.63) },
  { code: 'NBO', p: unit(-1.29, 36.82) },
  { code: 'SIN', p: unit(1.35, 103.82) },
  { code: 'TYO', p: unit(35.68, 139.65) },
];
function link(a: Vector, b: Vector) {
  const angle = Math.acos(Math.min(1, Math.max(-1, a.x * b.x + a.y * b.y + a.z * b.z)));
  return Array.from({ length: 97 }, (_, i) => {
    const t = i / 96;
    const h = (1 + 0.09 * Math.sin(Math.PI * t)) / Math.sin(angle);
    const u = h * Math.sin((1 - t) * angle),
      v = h * Math.sin(t * angle);
    return { x: a.x * u + b.x * v, y: a.y * u + b.y * v, z: a.z * u + b.z * v };
  });
}
const links = [
  [0, 1],
  [1, 2],
  [0, 3],
  [3, 4],
  [4, 5],
].map(([a, b]) => link(stations[a].p, stations[b].p));
const tones = ['#505050', '#656565', '#7d7d7d', '#949494', '#a9a9a9', '#bfbfbf', '#d5d5d5', '#dddddd'];
/**
 * #195: the gradients of the static layers (the glow around the globe, the ocean disc and the station halo) depend
 * only on the globe's place and radius, so they are made once per size and context and reused every frame. The glow
 * is filled over its own square, not the whole canvas, and the halo gradient sits at the origin and is moved by a
 * translate. Plain fills, no offscreen sprites: a sprite copied between an accelerated and an unaccelerated canvas
 * costs a readback per frame.
 */
type Cache = { key: string; glow: CanvasGradient; ocean: CanvasGradient; halo: CanvasGradient };
const caches = new WeakMap<CanvasRenderingContext2D, Cache>();
const HALO = 10;
function gradients(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): Cache {
  const key = `${cx}|${cy}|${r}`;
  const hit = caches.get(ctx);
  if (hit && hit.key === key) return hit;
  const glow = ctx.createRadialGradient(cx - r * 0.15, cy - r * 0.12, r * 0.7, cx, cy, r * 1.38);
  glow.addColorStop(0, 'rgba(141,141,141,0)');
  glow.addColorStop(0.57, 'rgba(128,128,128,.095)');
  glow.addColorStop(1, 'rgba(128,128,128,0)');
  const ocean = ctx.createRadialGradient(cx - r * 0.37, cy - r * 0.47, r * 0.03, cx + r * 0.2, cy + r * 0.24, r * 1.24);
  ocean.addColorStop(0, '#141414');
  ocean.addColorStop(0.43, '#101010');
  ocean.addColorStop(0.82, '#080808');
  ocean.addColorStop(1, '#242424');
  const halo = hit?.halo ?? ctx.createRadialGradient(0, 0, 0, 0, 0, HALO);
  if (!hit) {
    halo.addColorStop(0, 'rgba(245,245,245,.32)');
    halo.addColorStop(1, 'rgba(245,245,245,0)');
  }
  const made = { key, glow, ocean, halo };
  caches.set(ctx, made);
  return made;
}
function paint(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seconds: number,
  surface: Surface,
  yaw: number,
  particleStride: number,
) {
  ctx.clearRect(0, 0, w, h);
  const cx = w * 0.5,
    cy = h * 0.5;
  const r = globeRadius(w, h);
  const camera = (-18 + seconds * 1.6) * rad + yaw;
  const c = Math.cos(camera),
    s = Math.sin(camera);
  const cp = Math.cos(pitch),
    sp = Math.sin(pitch),
    ct = Math.cos(tilt),
    st = Math.sin(tilt);
  const project = (p: Vector) => {
    const x = p.x * c - p.z * s,
      depth = p.x * s + p.z * c,
      y = p.y * cp - depth * sp;
    return { x: cx + r * (x * ct - y * st), y: cy - r * (x * st + y * ct), z: p.y * sp + depth * cp };
  };
  function path(points: Vector[], color: string, width: number) {
    ctx.beginPath();
    let down = false;
    for (const p of points) {
      const q = project(p);
      if (q.z < 0) {
        down = false;
        continue;
      }
      if (down) ctx.lineTo(q.x, q.y);
      else ctx.moveTo(q.x, q.y);
      down = true;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  function circle(x: number, y: number, radius: number, color: string | CanvasGradient) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, tau);
    ctx.fillStyle = color;
    ctx.fill();
  }
  const cached = gradients(ctx, cx, cy, r);
  // Beyond r·1.38 from the centre the glow is fully transparent: fill only its square.
  const reach = r * 1.38;
  ctx.fillStyle = cached.glow;
  ctx.fillRect(cx - reach, cy - reach, 2 * reach, 2 * reach);
  const scene = { x: cx, y: cy, radius: r, width: w, height: h, time: seconds };
  drawStars(ctx, scene, particleStride);
  drawSatellites(ctx, scene, false);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, tau);
  ctx.fillStyle = cached.ocean;
  ctx.fill();
  ctx.beginPath();
  for (let line = 0; line + 1 < gratStart.length; line++) {
    let down = false;
    for (let i = gratStart[line]; i < gratStart[line + 1]; i++) {
      const px = gratX[i], py = gratY[i], pz = gratZ[i];
      const depth = px * s + pz * c;
      if (py * sp + depth * cp < 0) {
        down = false;
        continue;
      }
      const x = px * c - pz * s,
        y = py * cp - depth * sp;
      const qx = cx + r * (x * ct - y * st),
        qy = cy - r * (x * st + y * ct);
      if (down) ctx.lineTo(qx, qy);
      else ctx.moveTo(qx, qy);
      down = true;
    }
  }
  ctx.strokeStyle = 'rgba(172,172,172,.33)';
  ctx.lineWidth = 0.58;
  ctx.stroke();
  const size = Math.max(0.69, r / 156);
  const breath = 0.1 * Math.sin(seconds * 0.65);
  if (surface === 'mesh') {
    ctx.beginPath();
    for (const p of land) {
      const q = project(p);
      if (q.z <= 0.035) continue;
      for (const neighbor of [p.north, p.east]) {
        if (!neighbor) continue;
        const b = project(neighbor);
        if (b.z < 0) continue;
        ctx.moveTo(q.x, q.y);
        ctx.lineTo(b.x, b.y);
      }
    }
    ctx.lineWidth = Math.max(0.45, r / 345);
    ctx.strokeStyle = 'rgba(195,195,195,.76)';
    ctx.stroke();
  } else {
    // #195: back-facing points are dropped before the rest of the projection, from flat arrays.
    const k1 = -0.12 / r, k2 = -0.22 / r, base = 0.34 + (cx * 0.12 + cy * 0.22) / r + breath * 0.2;
    // #195: back-facing points are dropped before the rest of the projection, from flat arrays; the lit squares
    // are collected per tone level and filled as one path per level (8 fills instead of ~7,000 fillRects).
    for (const b of byLevel) b.n = 0;
    for (let i = 0; i < LAND_N; i += particleStride) {
      const px = landX[i], py = landY[i], pz = landZ[i];
      const depth = px * s + pz * c;
      const qz = py * sp + depth * cp;
      if (qz <= 0) continue;
      const x = px * c - pz * s,
        y = py * cp - depth * sp;
      const qx = cx + r * (x * ct - y * st),
        qy = cy - r * (x * st + y * ct);
      const light = base + qx * k1 + qy * k2 + qz * 0.42 + landTone[i] * 0.27;
      let level = (light * 7) | 0; // floor for light ≥ 0; below 0 it is clamped anyway
      if (level < 0) level = 0;
      else if (level > 7) level = 7;
      const b = byLevel[level];
      b.v[b.n++] = qx;
      b.v[b.n++] = qy;
      b.v[b.n++] = size * (0.6 + 0.52 * qz);
    }
    for (let level = 0; level < 8; level++) {
      const b = byLevel[level];
      if (!b.n) continue;
      ctx.beginPath();
      for (let j = 0; j < b.n; j += 3) {
        const side = b.v[j + 2];
        ctx.rect(b.v[j] - side / 2, b.v[j + 1] - side / 2, side, side);
      }
      ctx.fillStyle = tones[level];
      ctx.fill();
    }
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, tau);
  ctx.strokeStyle = 'rgba(211,211,211,.59)';
  ctx.lineWidth = 0.82;
  ctx.stroke();
  links.forEach((line, i) => {
    path(line, i === 0 ? 'rgba(210,210,210,.45)' : 'rgba(190,190,190,.31)', 0.95);
    const p = project(line[Math.floor(((seconds * 0.085 + i * 0.27) % 1) * (line.length - 1))]);
    if (p.z > 0) {
      circle(p.x, p.y, 3, 'rgba(239,239,239,.21)');
      circle(p.x, p.y, 1.35, '#cdcdcd');
    }
  });
  stations.forEach((station, i) => {
    const p = project(station.p);
    if (p.z < 0.09) return;
    const pulse = (seconds * 0.3 + i * 0.22) % 1;
    ctx.translate(p.x, p.y);
    circle(0, 0, HALO, cached.halo);
    ctx.translate(-p.x, -p.y);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.1 + 5 * pulse, 0, tau);
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = `rgba(245,245,245,${0.74 * (1 - pulse)})`;
    ctx.stroke();
    circle(p.x, p.y, 2.1, '#cfcfcf');
    if (r > 105 && i < 4) {
      ctx.font = '9px "IBM Plex Mono", monospace';
      ctx.fillStyle = '#d3d3d3';
      ctx.fillText(station.code, p.x + 7, p.y - 5);
    }
  });
  drawSatellites(ctx, scene, true);
}

export const earthPlate: RendererFactory = (canvas) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return {
    draw(f) {
      ctx.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
      paint(ctx, f.width, f.height, f.time, f.mesh ? 'mesh' : 'points', f.yaw, f.particleStride ?? 1);
    },
  };
};
