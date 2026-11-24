// Synthetic SCREEN snapshots, not orbital coordinates or a production collision algorithm.
// #11 owns physical projection, globe visibility and the final reserved-region policy.
const paths = [
  { id: 'ARRAY-01', kind: 'array', points: [[0.78, 0.30, 1, true], [0.9, 0.32, 1, true], [0.86, 0.7, 1, true], [0.48, 0.62, -1, false]] },
  { id: 'RELAY-02', kind: 'relay', points: [[0.2, 0.68, 1, true], [0.1, 0.8, 1, true], [0.48, 0.4, -1, false], [0.75, 0.18, -1, true]] },
];

export function syntheticSnapshots(time, region) {
  const period = 32;
  const phase = (((time % period) + period) % period) / period * 4;
  const index = Math.floor(phase), progress = phase - index;
  return paths.map(path => {
    const a = path.points[index], b = path.points[(index + 1) % 4];
    return {
      id: path.id, kind: path.kind,
      x: region.x + (a[0] + (b[0] - a[0]) * progress) * region.width,
      y: region.y + (a[1] + (b[1] - a[1]) * progress) * region.height,
      depth: a[2], visible: a[3],
      opacity: !a[3] ? 0 : !path.points[(index + 3) % 4][3] ? Math.min(1, progress / 0.05) : !b[3] ? Math.min(1, (1 - progress) / 0.05) : 1,
    };
  });
}
