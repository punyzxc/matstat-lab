import type { ModuleId } from './modules';

const linePath = (points: number[][]) =>
  points.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(2) + ',' + y.toFixed(2)).join('');
const seq = (n: number) => Array.from({ length: n }, (_, i) => i);
const bell = (x: number) => Math.exp((-x * x) / 2);
function terrain() {
  const project = (u: number, v: number) => [
    18 + u * 87 + v * 28,
    41 - u * 8 + v * 15 - 30 * bell((u - 0.56) * 6) * bell((v - 0.48) * 3.5),
  ];
  return (
    <>
      {seq(15).map((i) => (
        <path key={'r' + i} d={linePath(seq(60).map((j) => project(j / 59, i / 14)))} />
      ))}
      {seq(20).map((i) => (
        <path key={'c' + i} opacity=".58" d={linePath(seq(32).map((j) => project(i / 19, j / 31)))} />
      ))}
    </>
  );
}
function cage() {
  const p = (x: number, y: number, z: number) => [68 + x * 24 + y * 17, 37 + x * 5 - y * 11 - z * 24];
  return seq(3).map((axis) => (
    <g key={axis}>
      {seq(7).map((k) => (
        <g key={k}>
          {[0, 1].map((edge) => {
            const points =
              axis === 0
                ? [p(-1, k / 6, edge), p(1, k / 6, edge)]
                : axis === 1
                  ? [p(k / 3 - 1, 0, edge), p(k / 3 - 1, 1, edge)]
                  : [p(k / 3 - 1, edge, 0), p(k / 3 - 1, edge, 1)];
            return <path opacity={edge ? 0.92 : 0.5} key={edge} d={linePath(points)} />;
          })}
        </g>
      ))}
    </g>
  ));
}
export function PlateGlyph({ id }: { id: ModuleId }) {
  let content;
  switch (id) {
    case 'distribution':
      content = terrain();
      break;
    case 'estimation':
      content = cage();
      break;
    case 'convergence':
      content = seq(14).map((k) => (
        <path
          key={k}
          d={linePath(
            seq(70).map((j) => {
              const t = j / 69;
              return [
                12 + t * 110,
                33 +
                  Math.exp(-t * 3.3) * (Math.sin(k * 2.8 + t * 12) * 12 + Math.sin(k + t * 18) * 9) +
                  (k - 7) * 0.6,
              ];
            }),
          )}
        />
      ));
      break;
    case 'confidence':
      content = seq(16).map((k) => (
        <path
          key={k}
          d={linePath(
            seq(64).map((j) => {
              const t = j / 63;
              return [
                14 + 108 * t,
                34 - 10 * Math.sin(t * 5 - 0.8) + (k - 7.5) * (1.9 - 0.9 * t) * (1 - 0.45 * Math.cos(t * 6)),
              ];
            }),
          )}
        />
      ));
      break;
    case 'testing':
      content = seq(15).map((k) => (
        <path
          key={k}
          d={linePath(
            seq(85).map((j) => {
              const x = j / 84;
              return [10 + x * 112, 47 - k * 0.42 - 25 * bell((x - 0.35 - k * 0.019) * 8)];
            }),
          )}
        />
      ));
      break;
    case 'randomness':
      content = seq(440).map((i) => {
        const a = i * 2.39996,
          r = Math.sqrt((i + 0.5) / 440),
          x = Math.cos(a) * r,
          y = Math.sin(a) * r;
        return (
          <circle
            key={i}
            cx={67 + 51 * x}
            cy={32 + 17 * y + 7 * Math.sin(x * 5 + y * 3)}
            r={i % 5 === 0 ? 0.95 : 0.58}
            fill="currentColor"
            stroke="none"
          />
        );
      });
      break;
  }
  return (
    <svg
      className="plate-glyph"
      aria-hidden="true"
      viewBox="0 0 140 65"
      fill="none"
      stroke="currentColor"
      strokeWidth=".66"
    >
      {content}
    </svg>
  );
}
