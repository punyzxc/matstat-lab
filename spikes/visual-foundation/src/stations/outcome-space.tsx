import { MathText } from '../math';
import { t, useLang } from '../i18n';
import { useStationReducedMotion } from '../motion-preference';
import type { Space } from './kernel-contract';

/**
 * #129: every elementary outcome of Ω as an object (two dice with pips, three coins, 36 cards). Outcomes of A have a
 * solid outline, of B a dashed one, and the event shown is filled; m of the n outcomes give P = m/n. The first trials
 * of each draw flash the outcome they hit, so the frequency below has a visible source.
 */
const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]], 2: [[0.27, 0.27], [0.73, 0.73]], 3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]], 5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]],
};
const SUITS = ['', '♠', '♣', '♦', '♥'];
const rankText = (r: number) => (r <= 10 ? String(r) : t(['J', 'Q', 'K', 'A'][r - 11], ['В', 'Д', 'К', 'Т'][r - 11]));

function Die({ x, y, s, v }: { x: number; y: number; s: number; v: number }) {
  return (
    <g className="os-die">
      <rect x={x} y={y} width={s} height={s} rx={3} />
      {(PIPS[v] ?? []).map(([px, py], i) => <circle key={i} cx={x + px * s} cy={y + py * s} r={s * 0.085} />)}
    </g>
  );
}

export function OutcomeSpace({ space, drawKey }: { space: Space; drawKey: number }) {
  useLang();
  const reduced = useStationReducedMotion();
  const { kind, cols, parts, inA, inB, inE, flashes, m, n } = space;
  const [cw, ch] = kind === 'dice' ? [52, 34] : kind === 'coins' ? [120, 52] : [54, 62];
  const rows = Math.ceil(parts.length / cols), PAD = 6;
  const W = cols * cw + 2 * PAD, H = rows * ch + 2 * PAD;
  const order = new Map<number, number>();
  flashes.forEach((p, i) => { if (!order.has(p)) order.set(p, i); });
  const name = (i: number) => {
    const p = parts[i];
    if (kind === 'dice') return `(${p[0]}, ${p[1]})`;
    if (kind === 'coins') return p.map((c) => (c ? t('H', 'Г') : t('T', 'Р'))).join('');
    return `${rankText(p[0])}${SUITS[p[1]]}`;
  };
  const summary = t(`Outcome space, ${n} outcomes; the event shown holds ${m}: ${parts.map((_, i) => i).filter((i) => inE[i]).map(name).join(', ')}`,
    `Пространство исходов, ${n} исходов; показанному событию благоприятствуют ${m}: ${parts.map((_, i) => i).filter((i) => inE[i]).map(name).join(', ')}`);

  return (
    <section className="outcome-space" aria-label={t('Outcome space', 'Пространство исходов')}>
      <p className="outcome-space-head">
        <b>Ω</b> · {t('solid outline: ', 'сплошная рамка: ')}<MathText text="$A$" /> · {t('dashed: ', 'пунктир: ')}<MathText text="$B$" /> · {t('filled: ', 'заливка: ')}<MathText text={`$${space.event}$`} />,{' '}
        <span className="outcome-space-count" data-m={m}><MathText text={`$m = ${m}$`} /> {t('of', 'из')} <MathText text={`$n = ${n}$`} /></span>
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} data-reduced={reduced || undefined} data-kind={kind} style={{ maxWidth: `${Math.min(W * 1.15, 760)}px` }}>
        <g key={drawKey}>
          {parts.map((p, i) => {
            const x = PAD + (i % cols) * cw, y = PAD + Math.floor(i / cols) * ch, f = order.get(i);
            return (
              <g key={i} className="os-cell" data-a={inA[i] || undefined} data-b={inB[i] || undefined} data-e={inE[i] || undefined}
                data-flash={f != null || undefined} style={f != null ? { animationDelay: `${f * 70}ms` } : undefined}>
                <rect className="os-box" x={x + 2} y={y + 2} width={cw - 4} height={ch - 4} rx={5} />
                {kind === 'dice' && <><Die x={x + cw / 2 - 20} y={y + ch / 2 - 9} s={18} v={p[0]} /><Die x={x + cw / 2 + 2} y={y + ch / 2 - 9} s={18} v={p[1]} /></>}
                {kind === 'coins' && p.map((c, j) => (
                  <g key={j} className="os-coin" data-heads={c || undefined}>
                    <circle cx={x + cw / 2 + (j - 1) * 30} cy={y + ch / 2} r={12} />
                    <text x={x + cw / 2 + (j - 1) * 30} y={y + ch / 2 + 4}>{c ? t('H', 'Г') : t('T', 'Р')}</text>
                  </g>
                ))}
                {kind === 'cards' && (
                  <g className="os-card" data-red={p[1] >= 3 || undefined}>
                    <text className="os-rank" x={x + cw / 2} y={y + ch / 2 - 4}>{rankText(p[0])}</text>
                    <text className="os-suit" x={x + cw / 2} y={y + ch / 2 + 16}>{SUITS[p[1]]}</text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </section>
  );
}
