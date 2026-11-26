type Scene = { x: number; y: number; radius: number; width: number; height: number; time: number };
type Point = { x: number; y: number; depth: number };

const turn = Math.PI * 2;
const craft = [
  {
    callSign: 'ARRAY',
    phase: 3.25,
    rate: 0.12,
    tilt: -0.58,
    depth: 0.91,
    orbit: 1.17,
    art: [' .---. +-+ .---. ', ' |:|:|=[*]=|:|:| ', ' *---* +-+ *---* ', '        |        '],
  },
  {
    callSign: 'RELAY',
    phase: 0.76,
    rate: -0.088,
    tilt: 0.65,
    depth: 0.83,
    orbit: 1.16,
    art: ['   .-.   ', '  ( @ )  ', '   \\|/   ', '  -[#]-  ', '   / \\   '],
  },
  {
    callSign: 'PROBE',
    phase: 0.32,
    rate: 0.103,
    tilt: -1.19,
    depth: 0.92,
    orbit: 1.19,
    art: ['    /\\    ', ' .-/[]\\-. ', ' <==##==> ', "   '||'   "],
  },
] as const;

const stars = Array.from({ length: 319 }, (_, i) => {
  const x = ((i * 187 + 197) % 659) / 659;
  const y = ((i * i * 103 + i * 83 + 53) % 653) / 653;
  return { x, y, phase: (i * 2.399) % turn, bright: i % 9 === 0, cross: i % 23 === 0 };
});
function cross(ctx: CanvasRenderingContext2D, x: number, y: number, length: number) {
  ctx.beginPath();
  ctx.moveTo(x - length, y);
  ctx.lineTo(x + length, y);
  ctx.moveTo(x, y - length);
  ctx.lineTo(x, y + length);
  ctx.stroke();
}
export function drawStars(ctx: CanvasRenderingContext2D, s: Scene) {
  const { width, height, time } = s;
  ctx.save();
  ctx.fillStyle = '#eaeaea';
  ctx.strokeStyle = '#e1e1e1';
  ctx.lineWidth = 0.65;
  for (const star of stars) {
    const x = star.x * width,
      y = star.y * height;
    const shimmer = 0.5 + 0.5 * Math.sin(star.phase + time * 0.71);
    ctx.globalAlpha = star.bright ? 0.2 + shimmer * 0.48 : 0.12 + shimmer * 0.22;
    const size = star.bright ? 1.45 : 0.75;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    if (star.cross) cross(ctx, x, y, 2.5 + shimmer * 2);
  }
  ctx.restore();
}

function orbitPoint(s: Scene, node: (typeof craft)[number], angle: number): Point {
  const ring = s.radius * node.orbit;
  const horizontal = ring * Math.cos(angle);
  const vertical = ring * Math.sin(angle) * Math.sqrt(1 - node.depth * node.depth);
  const c = Math.cos(node.tilt),
    sin = Math.sin(node.tilt);
  return {
    x: s.x + horizontal * c - vertical * sin,
    y: s.y + horizontal * sin + vertical * c,
    depth: Math.sin(angle),
  };
}

/** #195: the width of an ASCII-art row depends only on the font; measured once per font, not every frame. */
const widths = new Map<string, number>();
function artWidthOf(ctx: CanvasRenderingContext2D, row: string, font: string) {
  const key = font + '|' + row;
  let w = widths.get(key);
  if (w === undefined) {
    w = ctx.measureText(row).width;
    widths.set(key, w);
  }
  return w;
}

export function drawSatellites(ctx: CanvasRenderingContext2D, scene: Scene, front: boolean) {
  const { radius, width, height, time } = scene;
  ctx.save();
  for (const node of craft) {
    const phase = node.phase + time * node.rate;
    const spacecraft = orbitPoint(scene, node, phase);
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const p = orbitPoint(scene, node, (front ? 0 : Math.PI) + (i / 48) * Math.PI);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = front ? '#bfbfbf63' : '#a0a0a04c';
    ctx.lineWidth = 0.62;
    ctx.setLineDash(front ? [17, 4, 2, 4] : [2, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    if (spacecraft.depth >= 0 !== front) continue;
    ctx.fillStyle = '#ededed';
    for (let i = 7; i > 0; i--) {
      const trail = orbitPoint(scene, node, phase - Math.sign(node.rate) * i * 0.028);
      if (trail.depth >= 0 !== front) continue;
      ctx.globalAlpha = (8 - i) / 15;
      ctx.fillRect(trail.x, trail.y, 1.25, 1.25);
    }
    ctx.globalAlpha = 1;
    const font = radius > 180 ? 9.5 : 6.8;
    const spacing = font * 0.99;
    ctx.font = '500 ' + font + 'px "IBM Plex Mono", monospace';
    ctx.textBaseline = 'top';
    const artWidth = artWidthOf(ctx, node.art[0], ctx.font);
    const artHeight = node.art.length * spacing;
    const x = Math.max(3, Math.min(width - artWidth - 4, spacecraft.x - artWidth / 2));
    const y = Math.max(3, Math.min(height - artHeight - 14, spacecraft.y - artHeight / 2));
    ctx.fillStyle = '#090909c7';
    ctx.fillRect(x - 2, y - 1, artWidth + 4, artHeight + 2);
    ctx.fillStyle = '#e6e6e6';
    node.art.forEach((row, i) => ctx.fillText(row, x, y + i * spacing));
    ctx.fillStyle = '#f6f6f6';
    const lamp = 0.55 + 0.45 * Math.sin(time * 2 + node.phase);
    ctx.globalAlpha = 0.36 + lamp * 0.64;
    const lightX = x + artWidth + 3,
      lightY = y + 3;
    ctx.fillRect(lightX, lightY, 2, 2);
    if (radius > 148 && lamp > 0.78) {
      ctx.strokeStyle = '#e1e1e1';
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = lamp * 0.5;
      cross(ctx, lightX + 1, lightY + 1, 4);
    }
    ctx.globalAlpha = 1;
    if (radius > 148) {
      ctx.fillStyle = '#bcbcbc';
      ctx.fillText(node.callSign, x, y + artHeight + 3);
    }
  }
  ctx.restore();
}
