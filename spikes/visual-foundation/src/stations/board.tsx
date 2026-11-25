import { t, useLang } from '../i18n';
import { useStationReducedMotion } from '../motion-preference';
import type { Board as Data } from './kernel-contract';

/**
 * #90: the throws themselves. Buffon's needles fall onto ruled lines `d` apart and light up when they cross one;
 * darts land in the unit square over the typed region. Every mark is one of the throws the readouts count, so the
 * picture and the numbers come from the same draw.
 */
const S = 100; // view units per board unit
const fmt = (v: number) => String(Number(v.toPrecision(3))).replace('.', t('.', ','));

export function Board({ board, drawKey, onFocusLine }: { board: Data; drawKey: number; onFocusLine?: (line: number | null) => void }) {
  useLang();
  const reduced = useStationReducedMotion();
  if (board.kind === 'chords') return <Chords board={board} drawKey={drawKey} reduced={reduced} onFocusLine={onFocusLine} />;
  return board.kind === 'needles' ? <Needles board={board} drawKey={drawKey} reduced={reduced} /> : <Darts board={board} drawKey={drawKey} reduced={reduced} />;
}

/**
 * #124: Bertrand's paradox as three circles, one per way of taking "a chord at random". Each draws its own chords;
 * those longer than the side √3 of the inscribed triangle are lit. Hovering or focusing a circle lights its line
 * of the live formula.
 */
const METHOD: Record<string, [string, string]> = {
  radius: ['a point on a radius', 'точка на радиусе'],
  endpoints: ['random endpoints', 'случайные концы'],
  midpoint: ['a midpoint in the disc', 'середина в круге'],
};
const EXACT: Record<string, string> = { radius: '1/2', endpoints: '1/3', midpoint: '1/4' };
function Chords({ board, drawKey, reduced, onFocusLine }: { board: Extract<Data, { kind: 'chords' }>; drawKey: number; reduced: boolean; onFocusLine?: (line: number | null) => void }) {
  const R = 90;
  const tri = [0, 1, 2].map((k) => { const a = Math.PI / 2 + (2 * Math.PI * k) / 3; return `${R * Math.cos(a)},${-R * Math.sin(a)}`; }).join(' ');
  return (
    <figure className="board board--chords" data-reduced={reduced || undefined}>
      <figcaption className="board-head">
        <b>{t('Three ways to take a chord at random', 'Три способа взять хорду наудачу')}</b>
        <span>{t('lit: longer than the side √3 of the inscribed triangle', 'светятся хорды длиннее стороны √3 вписанного треугольника')}</span>
      </figcaption>
      <div className="chord-row">
        {board.circles.map((c, j) => {
          const [en, ru] = METHOD[c.id] ?? [c.label, c.label];
          const lit = c.long.filter(Boolean).length;
          return (
            <div key={c.id} className="chord-circle" data-method={c.id} tabIndex={0} role="group"
              aria-label={t(`${en}: ${lit} of the first ${c.chords.length} chords are long; share ${fmt(c.share)}, exact ${EXACT[c.id]}`, `${ru}: длинных ${lit} из первых ${c.chords.length} хорд; доля ${fmt(c.share)}, точно ${EXACT[c.id]}`)}
              onMouseEnter={() => onFocusLine?.(j)} onMouseLeave={() => onFocusLine?.(null)} onFocus={() => onFocusLine?.(j)} onBlur={() => onFocusLine?.(null)}>
              <svg viewBox={`${-R - 6} ${-R - 6} ${2 * R + 12} ${2 * R + 12}`} aria-hidden>
                <circle className="chord-disc" r={R} />
                <polygon className="chord-tri" points={tri} />
                <g key={drawKey}>
                  {c.chords.map(([x1, y1, x2, y2], i) => (
                    <line key={i} className="chord" data-long={c.long[i] || undefined} x1={x1 * R} y1={-y1 * R} x2={x2 * R} y2={-y2 * R} style={{ animationDelay: `${i * 18}ms` }} />
                  ))}
                </g>
              </svg>
              <div className="chord-caption">
                <span>{t(en, ru)}</span>
                <span className="chord-share" data-share={c.share}>{fmt(c.share)} <i>→ {EXACT[c.id]}</i></span>
              </div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

function Needles({ board, drawKey, reduced }: { board: Extract<Data, { kind: 'needles' }>; drawKey: number; reduced: boolean }) {
  const { d, l, strips, width, needles, hits } = board;
  const W = width * S, H = strips * d * S, PAD = 0.5 * d * S;
  const crossed = hits.filter(Boolean).length;
  return (
    <figure className="board" data-reduced={reduced || undefined}>
      <figcaption className="board-head">
        <b>{t("Buffon's needle", 'Игла Бюффона')}</b>
        <span>{t(`l = ${fmt(l)}, d = ${fmt(d)}`, `l = ${fmt(l)}, d = ${fmt(d)}`)}</span>
        <span className="board-count" data-count={crossed}>{t(`${crossed} of the first ${needles.length} needles cross a line`, `${crossed} из первых ${needles.length} игл пересекают прямую`)}</span>
      </figcaption>
      <svg viewBox={`0 ${-PAD} ${W} ${H + 2 * PAD}`} role="img"
        aria-label={t(`Needles of length ${fmt(l)} dropped on lines ${fmt(d)} apart: ${crossed} of ${needles.length} cross a line`, `Иглы длины ${fmt(l)} на прямых через ${fmt(d)}: ${crossed} из ${needles.length} пересекают прямую`)}>
        {Array.from({ length: strips + 1 }, (_, k) => <line key={k} className="board-rule" x1={0} x2={W} y1={H - k * d * S} y2={H - k * d * S} />)}
        <g key={drawKey}>
          {needles.map(([cx, cy, th], i) => {
            const dx = (l / 2) * Math.cos(th) * S, dy = (l / 2) * Math.sin(th) * S;
            const x = cx * S, y = H - cy * S;
            return (
              <g key={i} className="board-needle" data-hit={hits[i] || undefined} style={{ animationDelay: `${i * 8}ms` }}>
                <line x1={x - dx} y1={y + dy} x2={x + dx} y2={y - dy} />
                <circle cx={x} cy={y} r={2.2} />
              </g>
            );
          })}
        </g>
      </svg>
    </figure>
  );
}

function Darts({ board, drawKey, reduced }: { board: Extract<Data, { kind: 'region' }>; drawKey: number; reduced: boolean }) {
  const { runs, darts, hits } = board;
  const W = 300, inside = hits.filter(Boolean).length;
  return (
    <figure className="board board--region" data-reduced={reduced || undefined}>
      <figcaption className="board-head">
        <b>{t('Darts in the unit square', 'Дротики в единичном квадрате')}</b>
        <span className="board-count" data-count={inside}>{t(`${inside} of the first ${darts.length} land in A`, `${inside} из первых ${darts.length} попали в A`)}</span>
      </figcaption>
      <svg viewBox={`-14 -8 ${W + 22} ${W + 28}`} role="img"
        aria-label={t(`The region A shaded in the unit square; ${inside} of ${darts.length} darts land in it`, `Область A закрашена в единичном квадрате; в неё попали ${inside} из ${darts.length} дротиков`)}>
        <rect className="board-square" x={0} y={0} width={W} height={W} />
        <path className="board-region" d={runs.map(([x, y, w, h]) => `M${x * W} ${W - (y + h) * W}h${w * W}v${h * W}h${-w * W}z`).join('')} />
        <g key={drawKey}>
          {darts.map(([x, y], i) => (
            <circle key={i} className="board-dart" data-hit={hits[i] || undefined} cx={x * W} cy={W - y * W} r={2.4} style={{ animationDelay: `${Math.min(i, 300) * 2}ms` }} />
          ))}
        </g>
        <text className="board-tick" x={0} y={W + 7} dominantBaseline="hanging">0</text>
        <text className="board-tick" x={W} y={W + 7} textAnchor="end" dominantBaseline="hanging">1</text>
        <text className="board-tick" x={-4} y={0} textAnchor="end" dominantBaseline="hanging">1</text>
      </svg>
    </figure>
  );
}
