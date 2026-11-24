import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { animate as animateValue } from 'motion';
import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import type { modules } from './modules';
import { moduleReadout } from './method-readouts';
import { collect, histogram, moments, sources, type RunSettings } from './statistics';

type Snapshot = { settings: RunSettings; size: number; saved: boolean };
type Module = (typeof modules)[number];
type Series = { points: number[]; reference?: number };
type Chart =
  | { kind: 'histogram'; bins: number[] }
  | { kind: 'line'; series: Series }
  | { kind: 'estimate'; mean: number; standardError: number; reference: number }
  | { kind: 'interval'; bands: { center: number; radius: number }[]; reference: number }
  | { kind: 'signs'; above: number; total: number }
  | { kind: 'runs'; signs: boolean[] };

const width = 180;
const base = 37;
const left = 4;
const right = width - left;
const decimals = (value: number) => value.toFixed(3).replace(/^-0\.000$/, '0.000');
const linear = (value: number, lo: number, hi: number, start: number, end: number) =>
  start + ((value - lo) / (hi - lo || 1)) * (end - start);

function previewData(id: Module['id'], { settings, size }: Snapshot) {
  const sample = collect(settings).slice(0, size);
  const source = sources[settings.distribution];
  const stats = moments(sample)!;
  const [mean, variance] = source.theory(settings.scale);
  const show = (
    chart: Chart,
    caption: string,
    values: number[],
    format: (values: number[]) => string,
    description: string,
    measure: string,
  ) => ({ chart, caption, values, format, description, measure });
  const scalar = ([value]: number[]) => decimals(value);

  switch (id) {
    case 'distribution': {
      const { counts, outside } = histogram(sample, source.domain(settings.scale), 18);
      return show(
        { kind: 'histogram', bins: counts },
        'Frequency · 18 bins',
        [stats.mean],
        scalar,
        'Bin counts: ' + counts.join(', ') + (outside ? `. Outside range: ${outside}.` : '.'),
        'Sample mean',
      );
    }
    case 'convergence': {
      let average = 0;
      const points = sample.map((value, index) => {
        average += (value - average) / (index + 1);
        return average;
      });
      return show(
        { kind: 'line', series: { points, reference: mean } },
        'Prefix means',
        [stats.mean],
        scalar,
        `Running sample mean from the first draw to ${size}, with model mean ${decimals(mean)} as reference.`,
        'Final sample mean',
      );
    }
    case 'estimation': {
      const standardError = stats.deviation! / Math.sqrt(size);
      return show(
        { kind: 'estimate', mean: stats.mean, standardError, reference: mean },
        'Mean ± 1 SE',
        [standardError],
        scalar,
        `Estimated mean ${decimals(stats.mean)} plus or minus one estimated standard error.`,
        'Estimated standard error',
      );
    }
    case 'confidence': {
      const fractions = [0.25, 0.5, 1];
      const bands = fractions.map((fraction) => {
        const n = Math.max(2, Math.floor(size * fraction));
        return { center: moments(sample.slice(0, n))!.mean, radius: Math.sqrt(variance / (0.05 * n)) };
      });
      const { center, radius } = bands[bands.length - 1];
      return show(
        { kind: 'interval', bands, reference: mean },
        '95% Chebyshev intervals',
        [center - radius, center + radius],
        ([a, b]) => `${decimals(a)} … ${decimals(b)}`,
        '95% conservative intervals at one quarter, one half and all observations, using known model variance.',
        'Interval endpoints',
      );
    }
    case 'testing': {
      const median = settings.distribution === 'exponential' ? settings.scale * Math.LN2 : 0;
      const signs = sample.filter((value) => value !== median);
      const above = signs.filter((value) => value > median).length;
      const probability = Number(moduleReadout(id, sample, settings).value);
      return show(
        { kind: 'signs', above, total: signs.length },
        'Signs vs. 50% null',
        [probability],
        ([value]) => (value < 0.0001 ? '< 0.0001' : value.toFixed(4)),
        `${above} of ${signs.length} non-tied draws exceed the model median.`,
        'Two-sided exact sign test p-value',
      );
    }
    case 'randomness': {
      const median = settings.distribution === 'exponential' ? settings.scale * Math.LN2 : 0;
      const signs = sample
        .filter((value) => value !== median)
        .map((value) => value > median)
        .slice(-36);
      return show(
        { kind: 'runs', signs },
        `Last ${signs.length} non-tied draws`,
        [Number(moduleReadout(id, sample, settings).value)],
        ([value]) => String(Math.round(value)),
        'Points above and below the median in draw order. The count covers all non-tied observations.',
        'Observed runs',
      );
    }
  }
}

function HorizontalInterval({
  start,
  end,
  center,
  y,
  focal = false,
}: {
  start: number;
  end: number;
  center: number;
  y: number;
  focal?: boolean;
}) {
  return (
    <g opacity={focal ? 1 : 0.55}>
      <path
        d={`M${start},${y - 4}v8m0,-4H${end}m0,-4v8`}
        fill="none"
        stroke="currentColor"
        strokeWidth={focal ? 1.35 : 0.9}
      />
      <circle
        className={focal ? 'orbit-preview-mark' : undefined}
        cx={center}
        cy={y}
        r={focal ? 2.45 : 1.5}
        fill="currentColor"
      />
    </g>
  );
}

function ChartMarks({ chart }: { chart: Chart }) {
  switch (chart.kind) {
    case 'histogram': {
      const peak = Math.max(1, ...chart.bins);
      const cell = (right - left) / chart.bins.length;
      return (
        <g fill="currentColor">
          {chart.bins.map((count, i) => {
            const height = (count / peak) * 30;
            return (
              <rect
                key={i}
                x={left + i * cell}
                y={base - height}
                width={cell - 2}
                height={height}
                opacity={0.42 + (count / peak) * 0.52}
              />
            );
          })}
        </g>
      );
    }
    case 'line': {
      const { points, reference } = chart.series;
      const lo = Math.min(...points, reference ?? points[0]);
      const hi = Math.max(...points, reference ?? points[0]);
      const y = (value: number) => (lo === hi ? 22 : linear(value, lo, hi, base - 2, 6));
      return (
        <>
          {reference !== undefined && (
            <path d={`M${left},${y(reference)}H${right}`} className="orbit-preview-reference" />
          )}
          <polyline
            points={points
              .map(
                (point, i) =>
                  `${linear(i, 0, points.length - 1, left, right).toFixed(2)},${y(point).toFixed(2)}`,
              )
              .join(' ')}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.35"
          />
          <circle
            cx={right}
            cy={y(points[points.length - 1])}
            r="2.1"
            className="orbit-preview-mark"
            fill="currentColor"
          />
        </>
      );
    }
    case 'estimate': {
      const a = chart.mean - chart.standardError;
      const b = chart.mean + chart.standardError;
      const lo = Math.min(a, chart.reference);
      const hi = Math.max(b, chart.reference);
      const x = (value: number) => (lo === hi ? width / 2 : linear(value, lo, hi, 12, width - 12));
      return (
        <>
          <path d={`M${x(chart.reference)},6V${base}`} className="orbit-preview-reference" />
          <HorizontalInterval start={x(a)} end={x(b)} center={x(chart.mean)} y={22} focal />
        </>
      );
    }
    case 'interval': {
      const lo = Math.min(chart.reference, ...chart.bands.map(({ center, radius }) => center - radius));
      const hi = Math.max(chart.reference, ...chart.bands.map(({ center, radius }) => center + radius));
      const x = (value: number) => linear(value, lo, hi, 11, width - 11);
      return (
        <>
          <path d={`M${x(chart.reference)},4V${base}`} className="orbit-preview-reference" />
          {chart.bands.map(({ center, radius }, i) => (
            <HorizontalInterval
              key={i}
              start={x(center - radius)}
              end={x(center + radius)}
              center={x(center)}
              y={8 + i * 11}
              focal={i === chart.bands.length - 1}
            />
          ))}
        </>
      );
    }
    case 'signs': {
      const observed = chart.total ? linear(chart.above / chart.total, 0, 1, left, right) : width / 2;
      return (
        <>
          <path d={`M${left},20H${right}`} stroke="currentColor" strokeWidth=".8" opacity=".45" />
          {Array.from({ length: 11 }, (_, i) => {
            const x = linear(i, 0, 10, left, right);
            return <path key={i} d={`M${x},17v6`} fill="none" stroke="currentColor" opacity=".5" />;
          })}
          <path d={`M${width / 2},6V${base}`} className="orbit-preview-reference" />
          {chart.total > 0 && (
            <path d={`M${observed},10l4,5-4,5-4,-5z`} fill="currentColor" className="orbit-preview-mark" />
          )}
        </>
      );
    }
    case 'runs':
      return (
        <g>
          {chart.signs.map((sign, i) => {
            const x = linear(i, 0, Math.max(1, chart.signs.length - 1), left + 2, right - 2);
            const y = sign ? 10 : 29;
            const previous = chart.signs[i - 1] ? 10 : 29;
            const before = linear(i - 1, 0, Math.max(1, chart.signs.length - 1), left + 2, right - 2);
            return (
              <g key={i}>
                {i > 0 && (
                  <path
                    d={`M${before},${previous}H${x}V${y}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth=".55"
                    opacity=".42"
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={i === chart.signs.length - 1 ? 2.4 : 1.45}
                  className={i === chart.signs.length - 1 ? 'orbit-preview-mark' : undefined}
                  fill="currentColor"
                />
              </g>
            );
          })}
        </g>
      );
  }
}

function AnimatedMeasure({
  values,
  format,
  animate,
  label,
}: {
  values: number[];
  format: (values: number[]) => string;
  animate: boolean;
  label: string;
}) {
  const last = useRef(values);
  const final = format(values);
  const [visual, setVisual] = useState(final);
  useEffect(() => {
    const from = last.current;
    if (!animate || values.every((value, i) => value === from[i])) {
      last.current = values;
      setVisual(final);
      return;
    }
    const control = animateValue(0, 1, {
      duration: 0.42,
      ease: 'easeOut',
      onUpdate(t) {
        last.current = values.map((value, i) => from[i] + (value - from[i]) * t);
        setVisual(format(last.current));
      },
    });
    return () => control.stop();
  }, [values, final, format, animate]);
  return (
    <strong className="orbit-preview-value" aria-label={`${label}: ${final}`}>
      <span aria-hidden="true">{animate ? visual : final}</span>
    </strong>
  );
}

export function OrbitPreview({
  module,
  snapshot,
  active,
  animate,
  visited = false,
  onActivate,
}: {
  module: Module;
  snapshot: Snapshot;
  active: boolean;
  animate: boolean;
  visited?: boolean;
  onActivate?: () => void;
}) {
  const { count, distribution, scale, seed } = snapshot.settings;
  const { size, saved } = snapshot;
  const clip = useId();
  const revision = [distribution, scale, seed, size].join(':');
  const data = useMemo(
    () => previewData(module.id, { settings: { count, distribution, scale, seed }, size, saved }),
    [module.id, count, distribution, scale, seed, size, saved],
  );
  const source = sources[distribution].label.split(' (')[0];
  const status = saved ? 'Latest result' : 'Seeded preview';
  const valueLabel = `${data.measure}: ${data.format(data.values)}`;
  return (
    <a
      href={`#station/${module.id}`}
      className="orbit-preview"
      data-active={active}
      data-motion={animate}
      data-saved={saved}
      data-module={module.id}
      onClick={onActivate}
      aria-label={`${module.name}. ${visited ? 'Last opened. ' : ''}${status}. ${valueLabel}. ${source}, seed ${seed}, ${size} observations.`}
    >
      <span className="orbit-preview-head">
        <span className="orbit-preview-label">{module.name}</span>
        <ArrowUpRight className="orbit-preview-arrow" size={14} aria-hidden="true" />
      </span>
      <span className="orbit-preview-meta">
        <span title={valueLabel}>{data.measure}</span>
        <AnimatedMeasure values={data.values} format={data.format} animate={animate} label={data.measure} />
      </span>
      <svg
        viewBox={`0 0 ${width} 42`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${data.caption}. ${data.description}`}
        className="orbit-preview-chart"
      >
        <path
          d={`M${left},${base}H${right}`}
          fill="none"
          stroke="currentColor"
          strokeWidth=".68"
          opacity=".24"
        />
        <defs>
          <clipPath id={clip}>
            <motion.rect
              key={revision}
              width={width}
              height={42}
              initial={animate ? { scaleX: 0.25 } : false}
              animate={{ scaleX: 1 }}
              transition={{ duration: animate ? 0.42 : 0, ease: 'easeOut' }}
              style={{ originX: 0, originY: 0.5 }}
            />
          </clipPath>
        </defs>
        <g clipPath={animate ? `url(#${clip})` : undefined}>
          <ChartMarks chart={data.chart} />
        </g>
        <path
          d="M5,5V37"
          className="orbit-preview-scan"
          stroke="var(--signal)"
          strokeWidth=".65"
          opacity="0"
        />
      </svg>
      <span className="orbit-preview-provenance">
        <span>
          {status}
          {visited && <span className="orbit-preview-visited"> · Last opened</span>}
        </span>
        <span title={`${source}, seed ${seed}`}>
          {source} · n {size}
        </span>
      </span>
    </a>
  );
}
