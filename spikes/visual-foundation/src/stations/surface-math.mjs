/**
 * DOM-free math for the rotatable surface view (tested with `node --test`).
 * World space: x right, y into the screen (depth), z up. A view is { yaw, pitch } in radians:
 * yaw spins the scene about the vertical axis, pitch tilts the camera down (0 = side-on).
 * Projection is orthographic: rotate, then scale. Screen y grows downward.
 */

/** Project a world point to the screen. `depth` grows away from the viewer. */
export function project(point, view = {}, viewport = {}) {
  const [x, y, z] = point;
  const { yaw = 0, pitch = 0 } = view;
  const { cx = 0, cy = 0, scale = 1 } = viewport;
  const cosY = Math.cos(yaw), sinY = Math.sin(yaw), cosP = Math.cos(pitch), sinP = Math.sin(pitch);
  const xr = x * cosY - y * sinY;
  const yr = x * sinY + y * cosY;
  return { x: cx + xr * scale, y: cy - (z * cosP + yr * sinP) * scale, depth: yr * cosP - z * sinP };
}

/**
 * Painter's order. Each item is { points: [x, y, z][], bias?: number, ...anything }.
 * Returns { item, index, points (projected), depth } far-to-near, ties by input order.
 * A positive `bias` pulls the item toward the viewer (drawn later among equals).
 */
export function quadsByDepth(items, view, viewport) {
  return items
    .map((item, index) => {
      const points = item.points.map((p) => project(p, view, viewport));
      const depth = points.reduce((s, p) => s + p.depth, 0) / points.length - (item.bias ?? 0);
      return { item, index, points, depth };
    })
    .sort((a, b) => b.depth - a.depth || a.index - b.index);
}

/** "Nice" tick values (1, 2, 2.5, 5 x 10^k) inside [lo, hi]. */
export function niceTicks(lo, hi, target = 5) {
  if (!(hi > lo) || !Number.isFinite(lo) || !Number.isFinite(hi)) return [lo];
  const raw = (hi - lo) / Math.max(1, target);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out = [];
  const first = Math.ceil(lo / step - 1e-9), last = Math.floor(hi / step + 1e-9);
  for (let i = first; i <= last; i++) out.push(Number((i * step).toPrecision(12)) || 0);
  return out;
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => (Number.isFinite(a) && Number.isFinite(b) ? a + (b - a) * t : b);
export const easeOutCubic = (t) => 1 - (1 - clamp(t, 0, 1)) ** 3;
/** Elementwise interpolation of equal-length arrays. */
export const lerpArray = (a, b, t) => b.map((v, i) => lerp(a[i], v, t));
/** Elementwise interpolation of equal-shape 2D grids. */
export const lerpGrid = (a, b, t) => b.map((row, j) => lerpArray(a[j], row, t));
/** Map v from [lo, hi] to [-1, 1]. */
export const unit = (v, lo, hi) => (hi > lo ? -1 + (2 * (v - lo)) / (hi - lo) : 0);
