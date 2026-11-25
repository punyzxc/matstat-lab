/** Russian for the module-level tables: distributions, prototype modules (i18n/README.md). Imported once by main.tsx. */
import { localized } from './i18n-core';
import { modules } from './modules';
import { sources } from './statistics';

localized(sources.normal, {
  label: 'Нормальное (гауссово)', parameter: 'Ср. кв. отклонение $\\sigma$',
  description: 'Симметричный колокол с центром в нуле. Среднее квадратическое отклонение задаёт, насколько далеко наблюдения разбросаны вокруг среднего.',
});
localized(sources.uniform, {
  label: 'Равномерное', parameter: 'Полуширина $a$',
  description: 'Интервалы равной длины внутри носителя имеют одинаковую вероятность. Наблюдения скапливаются по-разному лишь случайно.',
});
localized(sources.exponential, {
  label: 'Показательное', parameter: 'Масштаб $\\beta$',
  description: 'Скошенная вправо модель времени ожидания. Большие значения редки, но теоретический носитель продолжается за пределы графика.',
});

const ruModules: Record<string, { name: string; description: string }> = {
  distribution: { name: 'Исследование распределения', description: 'Разыграйте выборку и сравните её форму с теоретической моделью.' },
  convergence: { name: 'Сходимость', description: 'Следите за скользящим выборочным средним по мере роста числа наблюдений.' },
  estimation: { name: 'Оценивание', description: 'Оцените среднее генеральной совокупности и измерьте неопределённость оценки.' },
  confidence: { name: 'Доверительные интервалы', description: 'Постройте доверительный интервал для среднего при известной дисперсии.' },
  testing: { name: 'Проверка гипотез', description: 'Точный двусторонний критерий знаков сравнивает выборку с медианой модели.' },
  randomness: { name: 'Случайность', description: 'Подсчитайте серии по обе стороны от медианы модели в исходном порядке значений.' },
};
for (const m of modules) localized(m, ruModules[m.id]);
