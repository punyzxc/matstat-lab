import type { ModuleId } from '../modules';
import { localized } from '../i18n-core';

/** Lecture blocks. Each one is an orbit of stations around the globe (docs/research/lecture-module-map.md). */
export const orbits = [
  localized({ id: 'probability', numeral: 'I', name: 'Probability', lectures: 'L1–L3' } as const, { name: 'Вероятность', lectures: 'Лекции 1–3' }),
  localized({ id: 'variables', numeral: 'II', name: 'Random variables', lectures: 'L4–L6' } as const, { name: 'Случайные величины', lectures: 'Лекции 4–6' }),
  localized({ id: 'limits', numeral: 'III', name: 'Limit theorems', lectures: 'L6–L9' } as const, { name: 'Предельные теоремы', lectures: 'Лекции 6–9' }),
  localized({ id: 'statistics', numeral: 'IV', name: 'Statistics', lectures: 'L10–L12' } as const, { name: 'Статистика', lectures: 'Лекции 10–12' }),
] as const;
export type OrbitId = (typeof orbits)[number]['id'];

type Base = { id: string; name: string; orbit: OrbitId; lectures: string; summary: string; hidden?: boolean };
/** A station backed by one of the six existing prototype instruments. */
export type LegacyStation = Base & { kind: 'legacy'; module: ModuleId };
/** A station whose kernel follows the shared contract (`spikes/<kernel>/kernel.mjs`). */
export type KernelStation = Base & { kind: 'kernel'; kernel: string; issue: number };
export type Station = LegacyStation | KernelStation;

export const stations: readonly Station[] = [
  { kind: 'kernel', id: 'urn', name: 'Urn', orbit: 'probability', lectures: 'L1', kernel: 'lecture-combinatorics', issue: 38,
    summary: 'Count ordered and unordered samples with and without replacement, then draw them.' },
  { kind: 'kernel', id: 'frequency', name: 'Frequency', orbit: 'probability', lectures: 'L1', kernel: 'lecture-geometric-probability', issue: 40,
    summary: 'Watch the relative frequency of an event settle near its probability.' },
  { kind: 'kernel', id: 'darts', name: 'Darts', orbit: 'probability', lectures: 'L1 · L4', kernel: 'lecture-geometric-probability', issue: 40,
    summary: 'Throw points into a region; compare the hit rate with the area ratio and the three Bertrand chords.' },
  { kind: 'kernel', id: 'bayes', name: 'Bayes', orbit: 'probability', lectures: 'L1 · L2', kernel: 'lecture-conditional-bayes', issue: 43,
    summary: 'Read conditional, total and posterior probabilities as counts of simulated outcomes.' },
  { kind: 'kernel', id: 'bernoulli', name: 'Bernoulli', orbit: 'probability', lectures: 'L3 · L9', kernel: 'lecture-bernoulli-approximations', issue: 39,
    summary: 'Compare the exact binomial law with the de Moivre–Laplace and Poisson approximations.' },

  { kind: 'legacy', id: 'distribution', name: 'Distribution Explorer', orbit: 'variables', lectures: 'L5', module: 'distribution',
    summary: 'Sample a distribution and compare its shape with the theoretical model.' },
  { kind: 'kernel', id: 'moments', name: 'Moments', orbit: 'variables', lectures: 'L6', kernel: 'lecture-random-vectors', issue: 44,
    summary: 'Compare mean, median, mode, skewness and kurtosis with theory; check the $3\\sigma$ rule.' },
  { kind: 'kernel', id: 'transform', name: 'Transform', orbit: 'variables', lectures: 'L6', kernel: 'lecture-random-vectors', issue: 44,
    summary: 'Push a sample through $y = \\varphi(x)$ and compare it with the transformed density.' },
  { kind: 'kernel', id: 'scatter', name: 'Scatter', orbit: 'variables', lectures: 'L6', kernel: 'lecture-random-vectors', issue: 44,
    summary: 'Sample a random vector; read covariance, correlation and both regression lines.' },

  { kind: 'kernel', id: 'convolution', name: 'Convolution', orbit: 'limits', lectures: 'L6', kernel: 'lecture-limit-theorems', issue: 41,
    summary: 'Add uniforms and compare the exact piecewise density with the simulated sum.' },
  { kind: 'legacy', id: 'convergence', name: 'Convergence', orbit: 'limits', lectures: 'L7', module: 'convergence',
    summary: 'Track the running sample mean as the number of observations grows.' },
  { kind: 'kernel', id: 'lln', name: 'Chebyshev & LLN', orbit: 'limits', lectures: 'L7', kernel: 'lecture-limit-theorems', issue: 41,
    summary: 'Set the Chebyshev bound $1/k^2$ against real tails, and watch running means settle, except for Cauchy.' },
  { kind: 'kernel', id: 'clt', name: 'CLT', orbit: 'limits', lectures: 'L8 · L9', kernel: 'lecture-limit-theorems', issue: 41,
    summary: 'Standardise sums of independent draws and compare them with the normal law.' },

  { kind: 'kernel', id: 'sample', name: 'Sample', orbit: 'statistics', lectures: 'L10', kernel: 'lecture-sampling-goodness-of-fit', issue: 45,
    summary: 'Build the variation series, frequency table, histogram and empirical CDF.' },
  { kind: 'kernel', id: 'fit', name: 'Fit', orbit: 'statistics', lectures: 'L10 · L12', kernel: 'lecture-sampling-goodness-of-fit', issue: 45,
    summary: 'Test a hypothesised law with the Kolmogorov and Pearson $\\chi^2$ criteria.' },
  { kind: 'kernel', id: 'estimation', name: 'Estimation', orbit: 'statistics', lectures: 'L11', kernel: 'lecture-estimation-intervals', issue: 46,
    summary: 'Repeat samples: $s^2$ with divisor $n$ is biased, with $n - 1$ it is not. Compare their MSE.' },
  { kind: 'kernel', id: 'confidence', name: 'Confidence Intervals', orbit: 'statistics', lectures: 'L11', kernel: 'lecture-estimation-intervals', issue: 46,
    summary: 'Build normal, $t$ and $\\chi^2$ intervals for the mean and variance; measure how often they cover the truth.' },
  { kind: 'kernel', id: 'testing', name: 'Hypothesis Testing', orbit: 'statistics', lectures: 'L12', kernel: 'lecture-hypothesis-tests', issue: 97,
    summary: 'Type $H_0\\colon a = a_0$ and the truth; watch repeated tests reject at rate $\\alpha$ or $1 - \\beta$, on a 3D power surface.' },
  { kind: 'kernel', id: 'homogeneity', name: 'Homogeneity', orbit: 'statistics', lectures: 'L11', kernel: 'lecture-estimation-intervals', issue: 46,
    summary: 'Test whether two series of trials share one probability p (z-test, formula 139).' },
  // Not in the lectures; the owner gave its orbit IV slot to Homogeneity (docs/decisions.md, 2026-11-25). Still reachable by URL.
  { kind: 'legacy', id: 'randomness', name: 'Randomness', orbit: 'statistics', lectures: 'extra', module: 'randomness', hidden: true,
    summary: 'Count runs on either side of the model median in the original draw order.' },
  { kind: 'kernel', id: 'contract-fixture', name: 'Contract fixture', orbit: 'probability', lectures: 'L1', kernel: 'scene-module-host', issue: 37, hidden: true,
    summary: 'Test fixture for the kernel contract; reachable only by URL.' },
];

/** Russian names and summaries (i18n/README.md); the English above stays the source. */
const ru: Record<string, { name: string; summary: string }> = {
  urn: { name: 'Урна', summary: 'Упорядоченные и неупорядоченные выборки с возвращением и без: подсчитайте и разыграйте.' },
  frequency: { name: 'Частота', summary: 'Посмотрите, как относительная частота события устанавливается около его вероятности.' },
  darts: { name: 'Дартс', summary: 'Бросайте точки в область: сравните долю попаданий с отношением площадей и три способа Бертрана провести хорду.' },
  bayes: { name: 'Байес', summary: 'Условная, полная и апостериорная вероятности как подсчёт смоделированных исходов.' },
  bernoulli: { name: 'Бернулли', summary: 'Сравните точный биномиальный закон с приближениями Муавра — Лапласа и Пуассона.' },
  distribution: { name: 'Исследование распределения', summary: 'Разыграйте выборку и сравните её форму с теоретической моделью.' },
  moments: { name: 'Моменты', summary: 'Сравните среднее, медиану, моду, асимметрию и эксцесс с теорией; проверьте правило $3\\sigma$.' },
  transform: { name: 'Преобразование', summary: 'Пропустите выборку через $y = \\varphi(x)$ и сравните её с плотностью преобразованной величины.' },
  scatter: { name: 'Рассеяние', summary: 'Разыграйте случайный вектор: ковариация, коэффициент корреляции и обе прямые регрессии.' },
  convolution: { name: 'Композиция', summary: 'Сложите равномерные величины и сравните точную кусочную плотность с моделью суммы.' },
  convergence: { name: 'Сходимость', summary: 'Следите за скользящим выборочным средним по мере роста числа наблюдений.' },
  lln: { name: 'Чебышёв и ЗБЧ', summary: 'Граница Чебышёва $1/k^2$ против настоящих хвостов; средние стабилизируются — кроме закона Коши.' },
  clt: { name: 'ЦПТ', summary: 'Стандартизуйте суммы независимых величин и сравните их с нормальным законом.' },
  sample: { name: 'Выборка', summary: 'Постройте вариационный ряд, таблицу частот, гистограмму и эмпирическую функцию распределения.' },
  fit: { name: 'Согласие', summary: 'Проверьте гипотезу о законе распределения по критериям Колмогорова и $\\chi^2$ Пирсона.' },
  estimation: { name: 'Оценивание', summary: 'Повторяйте выборки: $s^2$ с делителем $n$ смещена, с $n - 1$ — нет. Сравните их средний квадрат ошибки.' },
  confidence: { name: 'Доверительные интервалы', summary: 'Постройте нормальный, $t$- и $\\chi^2$-интервалы для среднего и дисперсии; измерьте, как часто они накрывают истинное значение.' },
  testing: { name: 'Проверка гипотез', summary: 'Задайте $H_0\\colon a = a_0$ и истину: повторные проверки отвергают $H_0$ с частотой $\\alpha$ или $1 - \\beta$; 3D-поверхность мощности.' },
  homogeneity: { name: 'Однородность', summary: 'Проверьте, одна ли вероятность $p$ у двух серий испытаний ($z$-критерий, формула 139).' },
  randomness: { name: 'Случайность', summary: 'Подсчитайте серии по обе стороны от медианы модели в исходном порядке значений.' },
  'contract-fixture': { name: 'Тестовое ядро', summary: 'Тестовое ядро для проверки контракта; открывается только по ссылке.' },
};
/** Lecture references in Russian, with their word: «Лекция 6», «Лекции 1 · 4» (English adds "Lecture" where it shows them). */
const ruLectures = (l: string) =>
  l === 'extra' ? 'Вне лекций' : `${l.includes('·') ? 'Лекции' : 'Лекция'} ${l.replace(/L(?=\d)/g, '')}`;
for (const s of stations) localized(s, { ...ru[s.id], lectures: ruLectures(s.lectures) });

/** Each orbit holds at most six stations: the six slots around the globe. */
export const stationsOf = (orbit: OrbitId) => stations.filter((s) => s.orbit === orbit && !s.hidden);
export const findStation = (id: string) => stations.find((s) => s.id === id);
/** Prototype module ids equal station ids, so a module whose station moved to a kernel keeps its orbit. */
export const orbitOfModule = (module: ModuleId): OrbitId =>
  stations.find((s) => (s.kind === 'legacy' && s.module === module) || s.id === module)?.orbit ?? 'variables';
