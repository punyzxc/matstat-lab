import { useEffect, useState, type RefObject } from 'react';
import type { ModuleId } from './modules';

type Point = { x: number; y: number };
type Link = { id: ModuleId; from: Point; end: Point; path: string };
type Layout = { width: number; height: number; links: Link[] };
export const globeRadius = (width: number, height: number) => Math.min(width * 0.426, height * 0.443);

export function OrbitLinks({
  field,
  active,
  playing,
}: {
  field: RefObject<HTMLDivElement | null>;
  active: ModuleId | null;
  playing: boolean;
}) {
  const [layout, setLayout] = useState<Layout>({ width: 0, height: 0, links: [] });
  useEffect(() => {
    const host = field.current;
    const core = host?.querySelector('.orbital-disc');
    if (!host || !core) return;
    const nodes = Array.from(host.querySelectorAll<HTMLElement>('[data-orbit-id]'));
    const measure = () => {
      const frame = host.getBoundingClientRect(),
        globe = core.getBoundingClientRect();
      const cx = globe.left - frame.left + globe.width / 2,
        cy = globe.top - frame.top + globe.height / 2;
      const radius = globeRadius(globe.width, globe.height);
      const narrow = window.matchMedia('(max-width: 760px)').matches;
      const links = nodes.map((node): Link => {
        const box = node.getBoundingClientRect();
        const side = box.left + box.width / 2 < globe.left + globe.width / 2 ? -1 : 1;
        const row = Number(node.dataset.row);
        let from: Point, end: Point, path: string;
        if (narrow) {
          const dx = side * (5 + row * 3);
          from = { x: cx + dx, y: cy + Math.sqrt(radius * radius - dx * dx) };
          end = { x: (side < 0 ? box.right : box.left) - frame.left, y: box.top - frame.top + 31 };
          const joinY = end.y;
          path = `M${from.x},${from.y} V${joinY - 10} Q${from.x},${joinY} ${end.x},${joinY}`;
        } else {
          const angle = (row - 1) * 0.72;
          from = { x: cx + side * Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
          end = { x: (side < 0 ? box.right : box.left) - frame.left, y: box.top - frame.top + 31 };
          const sx = from.x + side * (52 + row * 4),
            ex = end.x - side * 22;
          path = `M${from.x},${from.y} C${sx},${from.y} ${ex},${end.y} ${end.x},${end.y}`;
        }
        return { id: node.dataset.orbitId as ModuleId, from, end, path };
      });
      setLayout({ width: frame.width, height: frame.height, links });
    };
    const observer = new ResizeObserver(measure);
    [host, core, ...nodes].forEach((node) => observer.observe(node));
    measure();
    return () => observer.disconnect();
  }, [field]);

  if (!layout.links.length) return null;
  return (
    <svg
      className="orbit-links"
      viewBox={`0 0 ${layout.width || 1} ${layout.height || 1}`}
      aria-hidden="true"
    >
      {layout.links.map(({ id, from, end, path }, i) => (
        <g key={id} className="orbit-link" data-active={active === id}>
          <path d={path} className="orbit-link-trace" />
          <path
            d={path}
            className="orbit-link-pulse"
            pathLength="100"
            style={{ animationDelay: `${-i * 1.17}s` }}
          />
          <circle cx={from.x} cy={from.y} r="3" className="orbit-link-junction" />
          <circle cx={end.x} cy={end.y} r="3" className="orbit-link-terminal" />
        </g>
      ))}
      {playing && (
        <circle className="orbit-link-focal" r="2.1">
          <animateMotion
            key={active ?? 'first'}
            dur="3.8s"
            repeatCount="indefinite"
            path={layout.links.find((link) => link.id === active)?.path ?? layout.links[0]?.path}
          />
        </circle>
      )}
    </svg>
  );
}
