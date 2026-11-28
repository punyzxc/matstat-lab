import { useEffect, useRef } from 'react';
import { histogram, sources, type RunSettings } from './statistics.ts';
import { dec, t, useLang } from './i18n';
import { useQualityProfile } from './quality';

type Mode = 'histogram' | 'ecdf';

export function Plot({ sample, settings, mode, showTheory, densityPeak }: { sample: number[]; settings: RunSettings; mode: Mode; showTheory: boolean; densityPeak: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const lang = useLang();
  const { dprCap } = useQualityProfile();

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const draw = () => {
      const ctx = element.getContext('2d');
      if (!ctx) return;
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (width <= 0 || height <= 0) return;
      const ratio = Math.min(window.devicePixelRatio || 1, dprCap);
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
      ctx.scale(ratio, ratio);

      const model = sources[settings.distribution];
      const [min, max] = model.domain(settings.scale);
      const hist = histogram(sample, [min, max], 28, settings.count);
      const cdf = mode === 'ecdf';
      const modelAt = (x: number) => cdf ? model.cdf(x, settings.scale) : model.density(x, settings.scale);
      const theory = Array.from({ length: 161 }, (_, i) => {
        const x = min + (max - min) * i / 160;
        return [x, modelAt(x)] as const;
      });
      const peak = Math.max(0.1, densityPeak, ...theory.map(point => point[1]));
      const increment = peak > 1 ? 0.5 : peak > 0.5 ? 0.2 : 0.1;
      const top = cdf ? 1 : Math.round((Math.ceil(peak / increment) + 1) * increment * 100) / 100;
      const margin = { left: 47, right: 17, top: 20, bottom: 31 };
      const plotWidth = width - margin.left - margin.right;
      const plotHeight = height - margin.top - margin.bottom;
      const baseline = height - margin.bottom;
      const px = (x: number) => margin.left + (x - min) / (max - min) * plotWidth;
      const py = (y: number) => baseline - y / top * plotHeight;

      const line = (x1: number, y1: number, x2: number, y2: number) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      };

      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.lineWidth = 1;
      ctx.fillStyle = '#aaa';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let i = 0; i <= 4; i++) {
        const fraction = i / 4;
        const y = py(top * fraction);
        ctx.strokeStyle = i === 0 ? '#555' : '#292929';
        line(margin.left, y, width - margin.right, y);
        ctx.fillText(dec((top * fraction).toFixed(2)), margin.left - 9, y);
      }
      const ticks = width < 440 ? 4 : 8;
      ctx.textAlign = 'center';
      for (let i = 0; i <= ticks; i++) {
        const value = min + (max - min) * i / ticks;
        const x = px(value);
        ctx.strokeStyle = '#292929';
        line(x, margin.top, x, baseline);
        ctx.fillText(dec(Number(value.toFixed(2)).toString()), x, baseline + 15);
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(margin.left, margin.top, plotWidth, plotHeight + 1);
      ctx.clip();
      if (sample.length && !cdf) {
        const fill = ctx.createLinearGradient(0, margin.top, 0, baseline);
        fill.addColorStop(0, '#dedede');
        fill.addColorStop(1, '#494949');
        hist.density.forEach((value, i) => {
          if (!value) return;
          const x = margin.left + i * plotWidth / hist.density.length;
          const w = plotWidth / hist.density.length - 2;
          ctx.fillStyle = fill;
          ctx.fillRect(x + 1, py(value), w, baseline - py(value));
          ctx.fillStyle = '#f3f3f3';
          ctx.fillRect(x + 1, py(value), w, 1);
        });
      }
      if (sample.length && cdf) {
        const sorted = sample.slice().sort((a, b) => a - b);
        let rank = 0;
        while (rank < sorted.length && sorted[rank] < min) rank++;
        ctx.beginPath();
        ctx.moveTo(px(min), py(rank / sorted.length));
        for (; rank < sorted.length && sorted[rank] <= max; rank++) {
          ctx.lineTo(px(sorted[rank]), py(rank / sorted.length));
          ctx.lineTo(px(sorted[rank]), py((rank + 1) / sorted.length));
        }
        ctx.lineTo(px(max), py(rank / sorted.length));
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (showTheory) {
        ctx.beginPath();
        for (const [index, [x, y]] of theory.entries()) {
          if (index === 0) ctx.moveTo(px(x), py(y));
          else ctx.lineTo(px(x), py(y));
        }
        ctx.strokeStyle = '#ebe589';
        ctx.lineWidth = 1.7;
        ctx.setLineDash([5, 4]);
        ctx.stroke();
      }
      ctx.restore();
    };

    const observer = new ResizeObserver(draw);
    observer.observe(element);
    draw();
    return () => observer.disconnect();
  }, [sample, settings, mode, showTheory, densityPeak, dprCap, lang]);

  return <canvas className="plot-canvas" ref={canvas} role="img"
    aria-label={mode === 'ecdf' ? t('Empirical cumulative distribution, P(X ≤ x)', 'Эмпирическая функция распределения, P(X ≤ x)') : t('Histogram of observations, normalized as density', 'Гистограмма наблюдений, нормированная как плотность')} />;
}
