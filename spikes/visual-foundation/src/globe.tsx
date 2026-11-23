import type { RendererFactory } from './plate-canvas';
import landRows from './land-runs.json';

type Vector = { x: number; y: number; z: number };
type LandPoint = Vector & { tone: number; heat: number; east?: LandPoint; north?: LandPoint };
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
  const highlights = [unit(51.5, -0.1), unit(40.7, -74), unit(-1.3, 36.8)];
  const dot = (a: Vector, b: Vector) => a.x * b.x + a.y * b.y + a.z * b.z;
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
      const location = unit(lat, lon);
      const proximity = Math.max(...highlights.map((p) => dot(location, p)));
      const heat = Math.max(0, (proximity - 0.987) / 0.013);
      const point: LandPoint = { ...location, heat, tone: ((j * 31 + row * 17) % 23) / 23 };
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
const graticule: Vector[][] = [];
for (let lat = -75; lat < 90; lat += 15) {
  graticule.push(Array.from({ length: 181 }, (_, i) => unit(lat, i * 2 - 180)));
}
for (let lon = -180; lon < 180; lon += 15) {
  graticule.push(Array.from({ length: 91 }, (_, i) => unit(i * 2 - 90, lon)));
}

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
const warmTones = ['#827d5c', '#95916e', '#b0ac80', '#c3bd7d', '#d7d18c', '#e3dc8c', '#f1ec9d', '#faf6bd'];
const dust = Array.from({ length: 155 }, (_, i) => ({
  x: ((i * 173 + 91) % 997) / 997,
  y: ((i * i * 31 + i * 73 + 19) % 991) / 991,
}));

function paint(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seconds: number,
  surface: Surface,
  yaw: number,
) {
  ctx.clearRect(0, 0, w, h);
  const cx = w * 0.5,
    cy = h * 0.5;
  const r = Math.min(w * 0.365, h * 0.432);
  const camera = (-11 + seconds * 1.6) * rad + yaw;
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
  const glow = ctx.createRadialGradient(cx - r * 0.15, cy - r * 0.12, r * 0.7, cx, cy, r * 1.38);
  glow.addColorStop(0, 'rgba(141,141,141,0)');
  glow.addColorStop(0.57, 'rgba(128,128,128,.095)');
  glow.addColorStop(1, 'rgba(128,128,128,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#757575';
  for (const star of dust) ctx.fillRect(star.x * w, star.y * h, 0.9, 0.9);
  function orbit(front: boolean) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.31);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.29, r * 0.295, 0, front ? 0 : Math.PI, front ? Math.PI : tau);
    ctx.setLineDash(front ? [] : [2, 5]);
    ctx.lineWidth = 0.72;
    ctx.strokeStyle = front ? 'rgba(188,188,188,.49)' : 'rgba(155,155,155,.53)';
    ctx.stroke();
    ctx.restore();
  }
  orbit(false);
  const ocean = ctx.createRadialGradient(
    cx - r * 0.37,
    cy - r * 0.47,
    r * 0.03,
    cx + r * 0.2,
    cy + r * 0.24,
    r * 1.24,
  );
  ocean.addColorStop(0, '#2b2b2b');
  ocean.addColorStop(0.43, '#1b1b1b');
  ocean.addColorStop(0.82, '#0e0e0e');
  ocean.addColorStop(1, '#313131');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, tau);
  ctx.fillStyle = ocean;
  ctx.fill();
  for (const row of graticule) path(row, 'rgba(172,172,172,.33)', 0.58);
  const size = Math.max(0.85, r / 108);
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
    let last = -1;
    for (const p of land) {
      const q = project(p);
      if (q.z <= 0) continue;
      const light =
        0.34 + ((cx - q.x) / r) * 0.12 + ((cy - q.y) / r) * 0.22 + q.z * 0.42 + p.tone * 0.27 + breath * 0.2;
      const level = Math.min(7, Math.max(0, Math.floor(light * 7)));
      const warm = p.heat * (0.78 + breath + p.tone * 0.48) > 0.3;
      const pigment = level + (warm ? 8 : 0);
      if (pigment !== last) {
        ctx.fillStyle = warm ? warmTones[level] : tones[level];
        last = pigment;
      }
      const side = size * (0.6 + 0.52 * q.z);
      ctx.fillRect(q.x - side / 2, q.y - side / 2, side, side);
    }
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, tau);
  ctx.strokeStyle = 'rgba(211,211,211,.59)';
  ctx.lineWidth = 0.82;
  ctx.stroke();
  orbit(true);
  links.forEach((line, i) => {
    path(line, i === 0 ? 'rgba(239,232,127,.84)' : 'rgba(239,232,127,.59)', 0.95);
    const p = project(line[Math.floor(((seconds * 0.085 + i * 0.27) % 1) * (line.length - 1))]);
    if (p.z > 0) {
      circle(p.x, p.y, 3, 'rgba(239,232,127,.24)');
      circle(p.x, p.y, 1.35, '#cdcdcd');
    }
  });
  stations.forEach((station, i) => {
    const p = project(station.p);
    if (p.z < 0.09) return;
    const pulse = (seconds * 0.3 + i * 0.22) % 1;
    const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 10);
    halo.addColorStop(0, 'rgba(239,232,127,.62)');
    halo.addColorStop(1, 'rgba(239,232,127,0)');
    circle(p.x, p.y, 10, halo);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.1 + 5 * pulse, 0, tau);
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = `rgba(239,232,127,${0.74 * (1 - pulse)})`;
    ctx.stroke();
    circle(p.x, p.y, 2.1, '#cfcfcf');
    if (r > 105 && i < 4) {
      ctx.font = '9px "IBM Plex Mono", monospace';
      ctx.fillStyle = '#d3d3d3';
      ctx.fillText(station.code, p.x + 7, p.y - 5);
    }
  });
}

export const earthPlate: RendererFactory = (canvas) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return {
    draw(f) {
      ctx.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
      paint(ctx, f.width, f.height, f.time, f.mesh ? 'mesh' : 'points', f.yaw);
    },
  };
};
