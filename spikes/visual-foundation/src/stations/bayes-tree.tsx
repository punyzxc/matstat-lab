import { useState } from 'react';
import { SvgMathText } from '../math';
import { t, useLang } from '../i18n';
import { useStationReducedMotion } from '../motion-preference';
import type { BayesTree as Data } from './kernel-contract';

/**
 * #118: the living Bayes tree. Forward, each particle picks a hypothesis H_i and then whether A happens; a branch is
 * as wide as the probability of passing along it. Inverse regroups the same particles by the outcome: under A the
 * branches are the posteriors P(H_i | A). Widths, nodes and labels glide to their new places when a prior changes
 * or the mode flips; the particles are the first throws the readouts count.
 */
const W = 660, H = 300, TOP = 26, MID = 140, LEAF = 262, MAX_W = 44;
const fmt = (v: number) => t(String(Number(v.toFixed(3))), String(Number(v.toFixed(3))).replace('.', ','));
const tex = (v: number) => t(String(Number(v.toFixed(3))), String(Number(v.toFixed(3))).replace('.', '{,}'));
type Node = { id: string; x: number; y: number; label: string };
type Edge = { id: string; from: Node; to: Node; p: number; label: string; tone: 'a' | 'na' | 'h' };

const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => `M${a.x},${a.y} C${a.x},${(a.y + b.y) / 2} ${b.x},${(a.y + b.y) / 2} ${b.x},${b.y}`;

export function BayesTree({ tree, drawKey }: { tree: Data; drawKey: number }) {
  useLang();
  const reduced = useStationReducedMotion();
  const [inverse, setInverse] = useState(false);
  const { priors, lik, joint, pA, post, H: countH, HA, A, n, particles } = tree;
  const root: Node = { id: 'root', x: W / 2, y: TOP, label: '$\\Omega$' };
  const hx = (k: number) => (W * (2 * k + 1)) / 6;
  const nodes: Node[] = [root];
  const edges: Edge[] = [];
  const leafOf: Record<string, Node> = {};
  if (!inverse) {
    priors.forEach((q, k) => {
      const h: Node = { id: `H${k}`, x: hx(k), y: MID, label: `$H_${k + 1}$` };
      const a: Node = { id: `H${k}A`, x: hx(k) - 52, y: LEAF, label: '$A$' };
      const na: Node = { id: `H${k}N`, x: hx(k) + 52, y: LEAF, label: '$\\bar A$' };
      nodes.push(h, a, na);
      leafOf[`${k}1`] = a;
      leafOf[`${k}0`] = na;
      edges.push({ id: `e-root-H${k}`, from: root, to: h, p: q, label: `$P(H_${k + 1}) = ${tex(q)}$`, tone: 'h' },
        { id: `e-H${k}-A`, from: h, to: a, p: joint[k], label: `$${tex(lik[k])}$`, tone: 'a' },
        { id: `e-H${k}-N`, from: h, to: na, p: priors[k] - joint[k], label: `$${tex(1 - lik[k])}$`, tone: 'na' });
    });
  } else {
    const a: Node = { id: 'A', x: W * 0.3, y: MID, label: '$A$' }, na: Node = { id: 'N', x: W * 0.78, y: MID, label: '$\\bar A$' };
    nodes.push(a, na);
    edges.push({ id: 'e-root-A', from: root, to: a, p: pA, label: `$P(A) = ${tex(pA)}$`, tone: 'a' },
      { id: 'e-root-N', from: root, to: na, p: 1 - pA, label: `$P(\\bar A) = ${tex(1 - pA)}$`, tone: 'na' });
    priors.forEach((q, k) => {
      const ha: Node = { id: `AH${k}`, x: W * 0.3 + (k - 1) * 92, y: LEAF, label: `$H_${k + 1}$` };
      const hn: Node = { id: `NH${k}`, x: W * 0.78 + (k - 1) * 62, y: LEAF, label: `$H_${k + 1}$` };
      nodes.push(ha, hn);
      leafOf[`${k}1`] = ha;
      leafOf[`${k}0`] = hn;
      edges.push({ id: `e-A-H${k}`, from: a, to: ha, p: joint[k], label: post ? `$${tex(post[k])}$` : '', tone: 'h' },
        { id: `e-N-H${k}`, from: na, to: hn, p: q - joint[k], label: '', tone: 'na' });
    });
  }
  const width = (p: number) => Math.max(1, MAX_W * p);
  const count = (k: number, a: number) => (a ? HA[k] : countH[k] - HA[k]);
  const summary = inverse
    ? t(`Inverse tree: P(A) = ${fmt(pA)}; posteriors ${post ? post.map(fmt).join(', ') : 'undefined'}`, `Обратное дерево: P(A) = ${fmt(pA)}; апостериорные ${post ? post.map(fmt).join('; ') : 'не определены'}`)
    : t(`Forward tree: priors ${priors.map(fmt).join(', ')}; likelihoods ${lik.map(fmt).join(', ')}`, `Прямое дерево: априорные ${priors.map(fmt).join('; ')}; правдоподобия ${lik.map(fmt).join('; ')}`);
  return (
    <section className="bayes-tree" aria-label={t('Bayes tree', 'Дерево Байеса')} data-mode={inverse ? 'inverse' : 'forward'} data-reduced={reduced || undefined}>
      <div className="bt-head">
        <div className="bt-modes" role="radiogroup" aria-label={t('Tree', 'Дерево')}>
          <button type="button" role="radio" aria-checked={!inverse} onClick={() => setInverse(false)}>{t('Forward: hypothesis, then A', 'Прямое: гипотеза, затем A')}</button>
          <button type="button" role="radio" aria-checked={inverse} onClick={() => setInverse(true)}>{t('Inverse: by the outcome A', 'Обратное: по исходу A')}</button>
        </div>
        <span className="bt-count" data-a={A}>{t(`${A} of ${n} particles reached A`, `до A дошли ${A} из ${n} частиц`)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 12}`} role="img" aria-label={summary}>
        {edges.map((e) => (
          <path key={e.id} className="bt-edge" data-tone={e.tone} data-edge={e.id} style={{ d: `path('${curve(e.from, e.to)}')`, strokeWidth: width(e.p) }} d={curve(e.from, e.to)} />
        ))}
        <g key={`${drawKey}-${inverse}`} className="bt-particles">
          {particles.map(([k, a], i) => {
            const leaf = leafOf[`${k}${a}`];
            const mid = inverse ? nodes.find((m) => m.id === (a ? 'A' : 'N'))! : nodes.find((m) => m.id === `H${k}`)!;
            const route = `${curve(root, mid)} ${curve(mid, leaf).replace('M', 'L')}`;
            return reduced ? (
              <circle key={i} className="bt-particle" data-a={a || undefined} cx={leaf.x + ((i % 7) - 3) * 3} cy={leaf.y + 16 + Math.floor(i / 7) % 3 * 3} r={1.8} />
            ) : (
              <circle key={i} className="bt-particle" data-a={a || undefined} r={2.4} opacity={0}>
                <animateMotion dur="1.3s" begin={`${i * 0.035}s`} fill="freeze" path={route} />
                <set attributeName="opacity" to="1" begin={`${i * 0.035}s`} fill="freeze" />
              </circle>
            );
          })}
        </g>
        {edges.filter((e) => e.label).map((e) => (
          <g key={'l' + e.id} className="bt-label" style={{ transform: `translate(${(e.from.x + e.to.x) / 2 + (e.to.x < e.from.x ? -8 : 8)}px, ${(e.from.y + e.to.y) / 2}px)` }}>
            <SvgMathText x={0} y={4} anchor={e.to.x < e.from.x ? 'end' : 'start'} width={150} text={e.label} />
          </g>
        ))}
        {nodes.map((m) => (
          <g key={m.id} className="bt-node" data-node={m.id} style={{ transform: `translate(${m.x}px, ${m.y}px)` }}>
            <circle r={13} />
            <SvgMathText x={0} y={5} anchor="middle" width={40} text={m.label} />
          </g>
        ))}
        {priors.map((_, k) => [1, 0].map((a) => {
          const leaf = leafOf[`${k}${a}`];
          return (
            <text key={`c${k}${a}`} className="bt-leaf-count" data-leaf={`${k}${a}`} x={leaf.x} y={leaf.y + 30} textAnchor="middle">
              {inverse && a && A > 0 ? `${count(k, a)}/${A}` : count(k, a)}
            </text>
          );
        }))}
      </svg>
    </section>
  );
}
