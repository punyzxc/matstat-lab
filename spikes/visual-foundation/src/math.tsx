import { Fragment, useMemo, type ReactNode } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import './math.css';
import { mathToPlain, splitMath, texToPlain } from './math-text.mjs';

export { mathToPlain, splitMath, texToPlain };

const cache = new Map<string, string>();
/** KaTeX HTML (with MathML for screen readers). Bad input renders as red source instead of throwing. */
function render(tex: string, display: boolean) {
  const key = (display ? 'D' : 'I') + tex;
  let html = cache.get(key);
  if (html == null) {
    html = katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'htmlAndMathml', strict: 'ignore', trust: false });
    if (cache.size > 2000) cache.clear();
    cache.set(key, html);
  }
  return html;
}

/** One formula typeset as in a textbook. `display` centres it on its own line at a larger size. */
export function Tex({ tex, display = false, className }: { tex: string; display?: boolean; className?: string }) {
  const html = useMemo(() => render(tex, display), [tex, display]);
  const Tag = display ? 'div' : 'span';
  return <Tag className={`tex${display ? ' tex-display' : ''}${className ? ' ' + className : ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Plain text with inline formulas between `$…$` (write `\$` for a dollar sign). Text without `$` renders unchanged. */
export function MathText({ text }: { text: ReactNode }): ReactNode {
  if (typeof text !== 'string' || !text.includes('$')) return text;
  return splitMath(text).map((part, i) => (part.math ? <Tex key={i} tex={part.value} /> : <Fragment key={i}>{part.value}</Fragment>));
}

/**
 * A text label inside an SVG chart. Labels with `$…$` are typeset in a foreignObject
 * (anchored like SVG text); plain labels stay as SVG text.
 */
export function SvgMathText({ x, y, text, anchor = 'start', className, width = 320 }: {
  x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end'; className?: string; width?: number;
}) {
  if (!text.includes('$')) return <text className={className} x={x} y={y} textAnchor={anchor}>{text}</text>;
  const left = anchor === 'start' ? x : anchor === 'middle' ? x - width / 2 : x - width;
  return (
    <foreignObject x={left} y={y - 15} width={width} height={22} className={`svg-math ${className ?? ''}`}>
      <div className={`svg-math-box svg-math-${anchor}`}><span><MathText text={text} /></span></div>
    </foreignObject>
  );
}
