import { useEffect, useState, useRef } from 'react';
import { histogram, sources, type RunSettings } from './statistics';
import { dec, t } from './i18n';
const pad = (n: number) => String(n).padStart(2, '0');
const num = (n: number) => dec(n.toFixed(3));
export function Trace({ sample, animate }: { sample: number[]; animate: boolean }) {
  const trace = useRef<SVGSVGElement>(null);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!animate) return;
    let timer = 0;
    let visible = false;
    function playback() {
      window.clearInterval(timer);
      if (visible && !document.hidden)
        timer = window.setInterval(() => setIndex((i) => (i + 1) % sample.length), 580);
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      playback();
    });
    if (trace.current) observer.observe(trace.current);
    document.addEventListener('visibilitychange', playback);
    return () => {
      window.clearInterval(timer);
      observer.disconnect();
      document.removeEventListener('visibilitychange', playback);
    };
  }, [animate, sample.length]);
  const span = Math.max(1, ...sample.map(Math.abs));
  const pts = sample.map((n, i) => `${(i / (sample.length - 1)) * 240},${32 - (n / span) * 25}`).join(' ');
  return (
    <>
      <svg
        ref={trace}
        className="trace-chart"
        viewBox="0 0 240 64"
        preserveAspectRatio="none"
        role="img"
        aria-label={t(`Trace of ${sample.length} observations. Vertical range plus or minus ${num(span)}.`, `Трасса из ${sample.length} наблюдений. Вертикальный диапазон: плюс-минус ${num(span)}.`)}
      >
        <path
          d="M0 10H240M0 32H240M0 54H240M48 4V60M96 4V60M144 4V60M192 4V60"
          fill="none"
          stroke="#303030"
          strokeDasharray="2 4"
        />
        <polygon points={`0,32 ${pts} 240,32`} fill="#bbb" fillOpacity=".09" />
        <polyline
          points={pts}
          fill="none"
          stroke="#ddd"
          strokeWidth="1.35"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={(index / (sample.length - 1)) * 240}
          x2={(index / (sample.length - 1)) * 240}
          y1="3"
          y2="61"
          stroke="#dfd568"
          strokeOpacity=".45"
          strokeDasharray="2 3"
        />
        <circle
          cx={(index / (sample.length - 1)) * 240}
          cy={32 - (sample[index] / span) * 25}
          r="2.2"
          fill="#eee782"
        />
      </svg>
      <div className="axis-pair">
        <span>
          {t('DRAW', 'ЗНАЧЕНИЕ')} {pad(index + 1)} / {sample.length}
        </span>
        <span className="trace-value">{num(sample[index])}</span>
      </div>
    </>
  );
}
export function Matrix({ sample, settings }: { sample: number[]; settings: RunSettings }) {
  const domain = sources[settings.distribution].domain(settings.scale);
  const h = histogram(sample, domain, 34);
  const max = Math.max(1, ...h.counts);
  return (
    <div className="matrix-panel">
      <div
        className="matrix-wrap"
        role="img"
        aria-label={t(`Histogram of the session sample. Bin counts in ascending order: ${h.counts.join(', ')}. ${h.outside} outside the domain.`, `Гистограмма выборки сеанса. Частоты интервалов по возрастанию: ${h.counts.join(', ')}. Вне области: ${h.outside}.`)}
      >
        {Array.from({ length: 8 }, (_, i) => (
          <pre key={i} aria-hidden="true">
            {h.counts
              .map((n) => {
                const depth = (n / max) * 8 - (7 - i);
                return depth >= 0.85 ? '#' : depth > 0.4 ? '+' : depth > 0 ? ':' : '·';
              })
              .join('')
              .split(/(·+)/)
              .map((part, index) => (
                <span key={index} className={part.startsWith('·') ? 'matrix-empty' : undefined}>
                  {part}
                </span>
              ))}
          </pre>
        ))}
      </div>
      <div className="axis-pair">
        <span>{dec(domain[0].toFixed(1))}</span>
        <span>{t('34 BINS', '34 ИНТЕРВАЛА')}</span>
        <span>{dec(domain[1].toFixed(1))}</span>
      </div>
      {h.outside > 0 && <p className="outside-count">{t(`${h.outside} outside range`, `Вне диапазона: ${h.outside}`)}</p>}
    </div>
  );
}
