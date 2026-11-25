import { moments, sources, type RunSettings } from './statistics.ts';
import type { ModuleId } from './modules.ts';

function signProbability(n: number, k: number) {
  // Relative binomial weights avoid factorial overflow even for the largest supported n.
  const mode = Math.floor(n / 2);
  let weight = 1,
    total = 1,
    tail = mode <= k || mode >= n - k ? 1 : 0;
  for (let i = mode - 1; i >= 0; i--) {
    weight *= (i + 1) / (n - i);
    total += weight;
    if (i <= k || i >= n - k) tail += weight;
  }
  weight = 1;
  for (let i = mode + 1; i <= n; i++) {
    weight *= (n - i + 1) / i;
    total += weight;
    if (i <= k || i >= n - k) tail += weight;
  }
  return Math.min(1, tail / total);
}

/** `t(en, ru)` picks the language (src/i18n.ts); English by default, so node tests need no app state. */
export function moduleReadout(id: ModuleId, sample: number[], settings: RunSettings, t: (en: string, ru: string) => string = (en) => en) {
  const stats = moments(sample)!;
  const n = sample.length;
  const [mean, variance] = sources[settings.distribution].theory(settings.scale);
  const median = settings.distribution === 'exponential' ? settings.scale * Math.LN2 : 0;
  // All supported models are continuous. Exact ties carry no sign.
  const signs = sample.filter((x) => x !== median).map((x) => x > median);
  const above = signs.filter(Boolean).length;
  const runs = signs.reduce((total, value, i) => total + Number(i === 0 || value !== signs[i - 1]), 0);
  const v = (x: number) => x.toFixed(4);
  switch (id) {
    case 'convergence':
      return {
        label: t('Running sample mean', 'Скользящее выборочное среднее'),
        value: v(stats.mean),
        formula: String.raw`\bar{x}_n = \frac{1}{n}\sum_{i=1}^{n} x_i`,
        detail: t(`The model mean is ${v(mean)}. Absolute error at $n = ${n}$ is ${v(Math.abs(stats.mean - mean))}.`, `Среднее модели равно ${v(mean)}. Абсолютная ошибка при $n = ${n}$ равна ${v(Math.abs(stats.mean - mean))}.`),
      };
    case 'estimation':
      return {
        label: t('Estimated standard error', 'Оценка стандартной ошибки'),
        value: v(stats.deviation! / Math.sqrt(n)),
        formula: String.raw`\mathrm{SE} = \frac{s}{\sqrt{n}}`,
        detail: t(`The point estimate is ${v(stats.mean)}. The estimated standard error uses sample standard deviation $s = ${v(stats.deviation!)}$.`, `Точечная оценка равна ${v(stats.mean)}. Стандартная ошибка оценена по выборочному среднему квадратическому отклонению $s = ${v(stats.deviation!)}$.`),
      };
    case 'confidence': {
      const radius = Math.sqrt(variance / (0.05 * n));
      return {
        label: t('95% Chebyshev interval', '95-процентный интервал Чебышёва'),
        value: `[${v(stats.mean - radius)}, ${v(stats.mean + radius)}]`,
        formula: String.raw`\bar{x} \pm \sqrt{\frac{\sigma^2}{0.05\,n}}`,
        detail:
          t('With independent draws and known finite population variance, this interval has at least 95% repeated-sample coverage.', 'При независимых наблюдениях и известной конечной дисперсии генеральной совокупности такой интервал накрывает истинное среднее не менее чем в 95% повторных выборок.'),
      };
    }
    case 'testing':
      return {
        label: t('Two-sided p-value', 'Двустороннее $p$-значение'),
        value: v(signProbability(signs.length, Math.min(above, signs.length - above))),
        formula: t(String.raw`K \sim \mathrm{Bin}\bigl(n, \tfrac12\bigr) \ \text{under}\ H_0`, String.raw`K \sim \mathrm{Bin}\bigl(n, \tfrac12\bigr) \ \text{при}\ H_0`),
        detail: t(`${above} of ${signs.length} non-tied observations exceed the model median ${v(median)}. The test sums both equally extreme binomial tails.`, `${above} из ${signs.length} наблюдений, не совпадающих с медианой модели ${v(median)}, больше её. Критерий складывает оба одинаково крайних хвоста биномиального закона.`),
      };
    case 'randomness':
      return {
        label: t('Observed runs', 'Наблюдаемое число серий'),
        value: String(runs),
        formula: t(String.raw`R = 1 + \#\{\text{sign changes}\}`, String.raw`R = 1 + \#\{\text{смен знака}\}`),
        detail: t(`Each run is a consecutive group on one side of the model median. With ${above} signs above and ${signs.length - above} below in random order, the expected run count is $MR = 1 + \\frac{2n_1n_2}{n}$ = ${v(signs.length ? 1 + (2 * above * (signs.length - above)) / signs.length : 0)}.`, `Серия — это группа подряд идущих значений по одну сторону от медианы модели. При ${above} знаках выше и ${signs.length - above} ниже в случайном порядке ожидаемое число серий $MR = 1 + \\frac{2n_1n_2}{n}$ = ${v(signs.length ? 1 + (2 * above * (signs.length - above)) / signs.length : 0)}.`),
      };
    default:
      return {
        label: t('Sample mean', 'Выборочное среднее'),
        value: v(stats.mean),
        formula: String.raw`\bar{x} = \frac{1}{n}\sum_{i=1}^{n} x_i`,
        detail: sources[settings.distribution].description,
      };
  }
}
