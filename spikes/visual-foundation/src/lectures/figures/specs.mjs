// Live lecture figures (#110): what each figure shows and which numbers it shares with formulas and stations.
// Pure data, no React, so the script validator and `node --test` can check lecture scripts against it.
// Colours: one per variable across the whole scene (#109). Text with $…$ is typeset.

export const PALETTE = Object.freeze({
  signal: '#e8e485', cyan: '#7fd6e8', coral: '#ff8a6b', violet: '#b9a2ff', mint: '#8fe3b0', ink: '#f4f4f2',
});

/**
 * params: keys a step may preset, a reader may type, and a "what if" chip may set.
 * vars:   every key a live formula may use (\lv, \lval, \lres), with its colour and hint.
 * beats:  the scenes a step can ask the figure to show.
 * station(params): the full station this figure expands into, or null.
 */
export const FIGURES = Object.freeze({
  'clt-factory': {
    title: 'The normal distribution factory',
    seed: 808,
    beats: ['source', 'terms', 'sum', 'standardize', 'histogram', 'normal', 'race'],
    beatTitles: { source: 'One term', terms: '$n$ independent terms', sum: 'The sum $S_n$', standardize: 'Centre and scale', histogram: 'Thousands of sums', normal: 'The normal law appears', race: 'Three sources, one limit' },
    params: {
      n: { label: 'Terms in the sum $n$', min: 1, max: 100, step: 1, default: 12 },
      src: { label: 'Law of one term (0 uniform, 1 exponential, 2 Bernoulli)', min: 0, max: 2, step: 1, default: 1 },
      p: { label: 'Bernoulli $p$', min: 0.01, max: 0.99, step: 0.01, default: 0.3 },
    },
    vars: {
      n: { color: PALETTE.signal, hint: 'How many independent terms go into one sum. Type a new value.' },
      p: { color: PALETTE.mint, hint: 'Success probability of one Bernoulli term.' },
      X: { color: PALETTE.cyan, hint: 'One term: a single draw from the source law (the dots falling from the top).' },
      S: { color: PALETTE.violet, hint: 'The sum of the n terms: one bead per replicate.' },
      a: { color: PALETTE.coral, hint: 'Expectation of one term, $a = MX$.' },
      sigma: { color: PALETTE.coral, hint: 'Standard deviation of one term, $\\sigma = \\sqrt{DX}$.' },
      z: { color: PALETTE.ink, hint: 'The standardized sum: centred by $na$, scaled by $\\sigma\\sqrt{n}$. It lands in the histogram.' },
      Phi: { color: PALETTE.signal, hint: 'The standard normal law $N(0,1)$, the limit.' },
      ks: { color: PALETTE.signal, hint: 'Kolmogorov distance $\\sup_z |F_R(z) - \\Phi(z)|$ between the histogram and the normal law.', digits: 3 },
      count: { color: PALETTE.ink, hint: 'Sums made so far.', digits: 0 },
      sum: { color: PALETTE.violet, hint: 'The latest sum.', digits: 2 },
      zlast: { color: PALETTE.ink, hint: 'The latest standardized sum.', digits: 2 },
      mean: { color: PALETTE.coral, hint: 'Expectation of one term.', digits: 3 },
      sd: { color: PALETTE.coral, hint: 'Standard deviation of one term.', digits: 3 },
    },
    station: ({ n, src }) => {
      const law = [0, 1, null][Math.round(src)] ?? null;
      return law == null ? null : { station: 'clt', params: { law, n: Math.min(100, Math.max(1, Math.round(n))), R: 4000, view: 0 } };
    },
  },
  'ci-wall': {
    title: 'The confidence interval wall',
    seed: 1111,
    beats: ['sample', 'interval', 'wall'],
    beatTitles: { sample: 'One sample, one mean', interval: 'One interval', wall: 'A thousand intervals' },
    params: {
      n: { label: 'Sample size $n$', min: 2, max: 100, step: 1, default: 10 },
      gamma: { label: 'Confidence level $\\gamma$', min: 0.8, max: 0.99, step: 0.01, default: 0.95 },
      law: { label: 'Law (0 normal, 1 skewed)', min: 0, max: 1, step: 1, default: 0 },
      method: { label: 'Quantile (0 Student $t$, 1 normal $z$)', min: 0, max: 1, step: 1, default: 0 },
    },
    vars: {
      n: { color: PALETTE.signal, hint: 'Observations in each sample. Type a new value.', digits: 0 },
      gamma: { color: PALETTE.cyan, hint: 'Confidence level: the share of intervals that should cover $a$.', digits: 2 },
      a: { color: PALETTE.coral, hint: 'The true mean, unknown to the statistician: the vertical line.' },
      xbar: { color: PALETTE.violet, hint: 'Sample mean $\\bar{x}$: the centre of one interval.', digits: 3 },
      s: { color: PALETTE.mint, hint: 'Corrected sample standard deviation.', digits: 3 },
      t: { color: PALETTE.cyan, hint: 'Quantile $t_{\\gamma}$ of Student\'s law with $n - 1$ degrees of freedom (or of the normal law).', digits: 3 },
      cover: { color: PALETTE.signal, hint: 'Share of intervals so far that cover $a$.', digits: 3 },
      hits: { color: PALETTE.signal, hint: 'Intervals that cover $a$.', digits: 0 },
      count: { color: PALETTE.ink, hint: 'Intervals built so far.', digits: 0 },
      width: { color: PALETTE.mint, hint: 'Mean width of the intervals.', digits: 3 },
    },
    station: ({ n, gamma, law }) => ({ station: 'confidence', params: { n: Math.round(n), gamma, law: Math.round(law), target: 0, R: 1000, view: 1 } }),
  },
  'estimate-cloud': {
    title: 'Clouds of estimates',
    seed: 1111,
    beats: ['cloud', 'race'],
    beatTitles: { cloud: 'A cloud of sample means', race: 'Divisor $n$ against $n - 1$' },
    params: {
      n: { label: 'Sample size $n$', min: 2, max: 50, step: 1, default: 5 },
      sigma: { label: 'True $\\sigma$', min: 0.5, max: 3, step: 0.5, default: 1 },
      law: { label: 'Law (0 normal, 1 skewed)', min: 0, max: 1, step: 1, default: 0 },
    },
    vars: {
      n: { color: PALETTE.signal, hint: 'Observations in each sample. Type a new value: the cloud rebuilds.', digits: 0 },
      sigma: { color: PALETTE.coral, hint: 'True standard deviation of one observation.', digits: 1 },
      s2: { color: PALETTE.coral, hint: 'True variance $\\sigma^2$: the line both estimates aim at.', digits: 3 },
      a: { color: PALETTE.coral, hint: 'The true mean: the centre the cloud gathers around.' },
      xbar: { color: PALETTE.violet, hint: 'Sample mean $\\bar{x}$ of the latest sample: one dot of the cloud.', digits: 3 },
      sdx: { color: PALETTE.violet, hint: 'Observed spread of the cloud: the standard deviation of all $\\bar{x}$ so far.', digits: 3 },
      sdth: { color: PALETTE.mint, hint: 'Theory: $\\sqrt{D\\bar{x}} = \\sigma/\\sqrt{n}$, the bracket under the cloud.', digits: 3 },
      vn: { color: PALETTE.coral, hint: 'Variance with divisor $n$ for the latest sample (upper histogram).', digits: 3 },
      vn1: { color: PALETTE.cyan, hint: 'Variance with divisor $n - 1$ for the latest sample (lower histogram).', digits: 3 },
      mn: { color: PALETTE.coral, hint: 'Mean of all divisor-$n$ estimates so far: it settles below $\\sigma^2$.', digits: 3 },
      mn1: { color: PALETTE.cyan, hint: 'Mean of all divisor-$(n - 1)$ estimates so far: it settles on $\\sigma^2$.', digits: 3 },
      mnth: { color: PALETTE.coral, hint: 'Theory: $M s_n^2 = \\dfrac{n-1}{n}\\sigma^2$.', digits: 3 },
      bias: { color: PALETTE.coral, hint: 'Observed bias of the divisor-$n$ estimate, against the theoretical $-\\sigma^2/n$.', digits: 3 },
      count: { color: PALETTE.ink, hint: 'Samples drawn so far.', digits: 0 },
    },
    station: ({ n, sigma, law }) => ({ station: 'estimation', params: { n: Math.round(n), sigma, law: Math.round(law), R: 2000, view: 0 } }),
  },
  'test-court': {
    title: 'The hypothesis court',
    seed: 1212,
    beats: ['laws', 'stream', 'power'],
    beatTitles: { laws: 'Two laws of one statistic', stream: 'A thousand verdicts', power: 'The power curve' },
    params: {
      n: { label: 'Sample size $n$', min: 2, max: 200, step: 1, default: 16 },
      a: { label: 'True mean $a$ ($H_0\\colon a_0 = 0$, $\\sigma = 1$)', min: -1.5, max: 1.5, step: 0.05, default: 0.5 },
      alpha: { label: 'Significance level $\\alpha$', min: 0.001, max: 0.2, step: 0.001, default: 0.05 },
      tail: { label: '$H_1$ (0 two-sided $\\ne$, 1 right $>$, 2 left $<$)', min: 0, max: 2, step: 1, default: 1 },
      truth: { label: 'Samples come from (0 $H_0$, 1 the true $a$)', min: 0, max: 1, step: 1, default: 1 },
    },
    vars: {
      n: { color: PALETTE.signal, hint: 'Observations in each sample. A larger $n$ pulls the two laws apart.', digits: 0 },
      a: { color: PALETTE.cyan, hint: 'The true mean. $H_1$ is true when $a \\ne a_0$; the cyan law is the statistic under it.', digits: 2 },
      a0: { color: PALETTE.ink, hint: 'The mean claimed by $H_0$.' },
      alpha: { color: PALETTE.coral, hint: 'Type I error: the coral area of the $H_0$ law inside the critical region.', digits: 3 },
      beta: { color: PALETTE.violet, hint: 'Type II error: the violet area of the $H_1$ law outside the critical region.', digits: 3 },
      power: { color: PALETTE.mint, hint: 'Power $1 - \\beta$: the green area of the $H_1$ law inside the critical region.', digits: 3 },
      ucr: { color: PALETTE.signal, hint: 'Critical value: the border of the critical region $\\mathcal{K}$.', digits: 3 },
      U: { color: PALETTE.ink, hint: 'The statistic of the latest sample, $U = \\dfrac{(\\bar{x} - a_0)\\sqrt{n}}{\\sigma}$.', digits: 3 },
      delta: { color: PALETTE.cyan, hint: 'Centre of the $H_1$ law: $\\delta = \\dfrac{(a - a_0)\\sqrt{n}}{\\sigma}$.', digits: 3 },
      rej: { color: PALETTE.signal, hint: 'Share of samples so far whose verdict is "reject $H_0$".', digits: 3 },
      count: { color: PALETTE.ink, hint: 'Samples judged so far.', digits: 0 },
    },
    station: ({ n, a, alpha, tail, truth }) => ({
      station: 'testing',
      params: { sigmaKnown: 1, a0: 0, mu: a, sigma: 1, n: Math.round(n), alpha, tail: Math.round(tail), R: 1000, view: 0, truth: Math.round(truth) },
    }),
  },
});

/** Russian texts of the specs (i18n/README.md): the same keys, Russian values. */
export const RU = Object.freeze({
  'clt-factory': {
    title: 'Фабрика нормального распределения',
    beatTitles: { source: 'Одно слагаемое', terms: '$n$ независимых слагаемых', sum: 'Сумма $S_n$', standardize: 'Центрируем и нормируем', histogram: 'Тысячи сумм', normal: 'Появляется нормальный закон', race: 'Три источника, один предел' },
    params: { n: 'Число слагаемых $n$', src: 'Закон слагаемого (0 равномерный, 1 показательный, 2 Бернулли)', p: '$p$ закона Бернулли' },
    vars: {
      n: 'Сколько независимых слагаемых входит в одну сумму. Введите новое значение.',
      p: 'Вероятность успеха одного слагаемого Бернулли.',
      X: 'Одно слагаемое: одно значение исходного закона (точки, падающие сверху).',
      S: 'Сумма $n$ слагаемых: одна бусина на повторение.',
      a: 'Математическое ожидание слагаемого, $a = MX$.',
      sigma: 'Среднее квадратическое отклонение слагаемого, $\\sigma = \\sqrt{DX}$.',
      z: 'Нормированная сумма: сдвинута на $na$, поделена на $\\sigma\\sqrt{n}$. Она падает в гистограмму.',
      Phi: 'Стандартный нормальный закон $N(0,1)$, предел.',
      ks: 'Расстояние Колмогорова $\\sup_z |F_R(z) - \\Phi(z)|$ между гистограммой и нормальным законом.',
      count: 'Сколько сумм уже построено.',
      sum: 'Последняя сумма.',
      zlast: 'Последняя нормированная сумма.',
      mean: 'Математическое ожидание слагаемого.',
      sd: 'Среднее квадратическое отклонение слагаемого.',
    },
  },
  'ci-wall': {
    title: 'Стена доверительных интервалов',
    beatTitles: { sample: 'Одна выборка, одно среднее', interval: 'Один интервал', wall: 'Тысяча интервалов' },
    params: { n: 'Объём выборки $n$', gamma: 'Доверительная вероятность $\\gamma$', law: 'Закон (0 нормальный, 1 асимметричный)', method: 'Квантиль (0 Стьюдента $t$, 1 нормальный $z$)' },
    vars: {
      n: 'Число наблюдений в каждой выборке. Введите новое значение.',
      gamma: 'Доверительная вероятность: доля интервалов, которые должны накрыть $a$.',
      a: 'Истинное среднее, неизвестное статистику: вертикальная линия.',
      xbar: 'Выборочное среднее $\\bar{x}$: центр одного интервала.',
      s: 'Исправленное выборочное среднее квадратическое отклонение.',
      t: 'Квантиль $t_{\\gamma}$ закона Стьюдента с $n - 1$ степенями свободы (или нормального закона).',
      cover: 'Доля уже построенных интервалов, накрывших $a$.',
      hits: 'Интервалы, накрывшие $a$.',
      count: 'Сколько интервалов уже построено.',
      width: 'Средняя ширина интервалов.',
    },
  },
  'estimate-cloud': {
    title: 'Облака оценок',
    beatTitles: { cloud: 'Облако выборочных средних', race: 'Делитель $n$ против $n - 1$' },
    params: { n: 'Объём выборки $n$', sigma: 'Истинное $\\sigma$', law: 'Закон (0 нормальный, 1 асимметричный)' },
    vars: {
      n: 'Число наблюдений в каждой выборке. Введите новое значение: облако перестроится.',
      sigma: 'Истинное среднее квадратическое отклонение одного наблюдения.',
      s2: 'Истинная дисперсия $\\sigma^2$: линия, в которую целятся обе оценки.',
      a: 'Истинное среднее: центр, вокруг которого собирается облако.',
      xbar: 'Выборочное среднее $\\bar{x}$ последней выборки: одна точка облака.',
      sdx: 'Наблюдаемый разброс облака: среднее квадратическое отклонение всех $\\bar{x}$.',
      sdth: 'Теория: $\\sqrt{D\\bar{x}} = \\sigma/\\sqrt{n}$, скобка под облаком.',
      vn: 'Дисперсия с делителем $n$ для последней выборки (верхняя гистограмма).',
      vn1: 'Дисперсия с делителем $n - 1$ для последней выборки (нижняя гистограмма).',
      mn: 'Среднее всех оценок с делителем $n$: оно устанавливается ниже $\\sigma^2$.',
      mn1: 'Среднее всех оценок с делителем $n - 1$: оно устанавливается на $\\sigma^2$.',
      mnth: 'Теория: $M s_n^2 = \\dfrac{n-1}{n}\\sigma^2$.',
      bias: 'Наблюдаемое смещение оценки с делителем $n$ против теоретического $-\\sigma^2/n$.',
      count: 'Сколько выборок уже сделано.',
    },
  },
  'test-court': {
    title: 'Суд над гипотезой',
    beatTitles: { laws: 'Два закона одной статистики', stream: 'Тысяча вердиктов', power: 'Кривая мощности' },
    params: {
      n: 'Объём выборки $n$',
      a: 'Истинное среднее $a$ ($H_0\\colon a_0 = 0$, $\\sigma = 1$)',
      alpha: 'Уровень значимости $\\alpha$',
      tail: '$H_1$ (0 двусторонняя $\\ne$, 1 правая $>$, 2 левая $<$)',
      truth: 'Выборки берутся из (0 $H_0$, 1 истинного $a$)',
    },
    vars: {
      n: 'Число наблюдений в каждой выборке. Чем больше $n$, тем дальше расходятся два закона.',
      a: 'Истинное среднее. $H_1$ верна, когда $a \\ne a_0$; голубой закон — статистика при ней.',
      a0: 'Среднее, которое утверждает $H_0$.',
      alpha: 'Ошибка первого рода: коралловая площадь закона $H_0$ внутри критической области.',
      beta: 'Ошибка второго рода: фиолетовая площадь закона $H_1$ вне критической области.',
      power: 'Мощность $1 - \\beta$: зелёная площадь закона $H_1$ внутри критической области.',
      ucr: 'Критическое значение: граница критической области $\\mathcal{K}$.',
      U: 'Статистика последней выборки, $U = \\dfrac{(\\bar{x} - a_0)\\sqrt{n}}{\\sigma}$.',
      delta: 'Центр закона $H_1$: $\\delta = \\dfrac{(a - a_0)\\sqrt{n}}{\\sigma}$.',
      rej: 'Доля уже рассмотренных выборок с вердиктом «отвергнуть $H_0$».',
      count: 'Сколько выборок уже рассмотрено.',
    },
  },
});

/** A figure spec with its texts in Russian (labels, hints, titles); numbers and ranges unchanged. */
export function russianSpec(id, spec) {
  const ru = RU[id];
  if (!ru) return spec;
  return {
    ...spec,
    title: ru.title,
    beatTitles: ru.beatTitles,
    params: Object.fromEntries(Object.entries(spec.params).map(([k, p]) => [k, { ...p, label: ru.params[k] ?? p.label }])),
    vars: Object.fromEntries(Object.entries(spec.vars).map(([k, v]) => [k, { ...v, hint: ru.vars[k] ?? v.hint }])),
  };
}

/** Parameter defaults of a figure merged with a preset, every value snapped into its range. */
export function figureParams(id, preset = {}) {
  const spec = FIGURES[id];
  const out = {};
  for (const [k, p] of Object.entries(spec.params)) {
    const v = Number.isFinite(preset[k]) ? preset[k] : p.default;
    out[k] = Math.min(p.max, Math.max(p.min, v));
  }
  return out;
}
