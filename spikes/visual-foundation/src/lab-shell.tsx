import type { ReactNode } from 'react';
import { ArrowUpRight, BookOpen, GraduationCap } from 'lucide-react';
import { Tex } from './math';
import { orbits, type OrbitId } from './stations/catalog';
import { orbitHash } from './stations/route';
import { setLang, t, useLang } from './i18n';

export function LabMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 40 40"
      className="lab-mark"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
    >
      {Array.from({ length: 8 }, (_, i) => (
        <ellipse key={i} cx="20" cy="20" rx="6" ry="16.5" transform={`rotate(${i * 22.5} 20 20)`} />
      ))}
      <circle cx="20" cy="20" r="2.2" fill="currentColor" />
    </svg>
  );
}
export function LabNotesContent() {
  return (
    <div className="lab-notes-body">
      <h3>{t('Geometric studies', 'Геометрические этюды')}</h3>
        <p>
          {t(
            'The trefoil winds twice around a torus and three times through its hole. The yellow cross-section sits at the probability coordinate ',
            'Трилистник дважды обвивает тор и трижды проходит через его отверстие. Жёлтое сечение стоит на вероятностной координате ',
          )}
          <Tex tex="F(x)" />
          {t(
            ' of the inspected draw. Choose the draw readout to advance through the sample. Drag it horizontally or use the left and right arrow keys to turn it. The Earth study projects Natural Earth land data onto a rotating sphere. The ASCII satellites, starfield and links are simulated.',
            ' выбранного значения. Нажмите на показание значения, чтобы перейти к следующему. Поворачивайте фигуру перетаскиванием по горизонтали или стрелками влево и вправо. Этюд «Земля» проецирует данные о суше Natural Earth на вращающуюся сферу. ASCII-спутники, звёздное небо и связи смоделированы.',
          )}
        </p>
        <h3>{t('Reading the sample', 'Как читать выборку')}</h3>
        <p>
          {t(
            'Each experiment uses a seeded sequence. The trace shows the first 48 draws in order. The ASCII histogram counts observations in 34 equal-width bins. Sample variance uses ',
            'Каждый эксперимент использует последовательность с заданным зерном. Трасса показывает первые 48 значений по порядку. ASCII-гистограмма считает наблюдения в 34 интервалах равной ширины. Выборочная дисперсия вычисляется с делителем ',
          )}
          <Tex tex="n - 1" />.
        </p>
        <h3>{t('Moving around', 'Навигация')}</h3>
      <p>
        {t(
          'Choose a lecture orbit in the top bar, then open a station from its card. A station opens inside the scene and Escape closes it. The address bar keeps the station, its parameters and its seed, so a copied link reopens the same run.',
          'Выберите орбиту лекций на верхней панели и откройте станцию с её карточки. Станция открывается прямо на сцене, Esc закрывает её. Адресная строка хранит станцию, её параметры и зерно, поэтому скопированная ссылка воспроизводит тот же прогон.',
        )}
      </p>
        <a
          href="https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/"
          target="_blank"
          rel="noreferrer"
        >
          {t('Earth geometry source', 'Источник геометрии Земли')} <ArrowUpRight size={14} aria-hidden="true" />
        </a>
    </div>
  );
}
export function LabHeader({ orbit, action }: { orbit?: OrbitId | null; action?: ReactNode }) {
  const lang = useLang();
  return (
    <header className="lab-bar">
      <div className="lab-brand">
        <a href={orbit ? orbitHash(orbit) : '#'} aria-label={t('STATUM LAB, back to the scene', 'STATUM LAB, назад к сцене')}>
          <LabMark />
          <strong translate="no">
            STATUM<span>LAB</span>
          </strong>
        </a>
      </div>
      <nav aria-label={t('Lecture orbits', 'Орбиты лекций')} className="orbit-switch">
        {orbits.map((o) => (
          <a key={o.id} href={orbitHash(o.id)} aria-current={orbit === o.id ? 'true' : undefined} title={t(`Lectures ${o.lectures}`, o.lectures)}>
            <b>{o.numeral}</b> {o.name}
          </a>
        ))}
      </nav>
      <div className="lab-session">
        {action}
        <a href="#lectures" className="lab-tool"><GraduationCap size={14} aria-hidden="true" /> {t('Lectures', 'Лекции')}</a>
        <a href="#record" className="lab-tool">{t('Sample record', 'Журнал выборки')}</a>
        <a href="#notes" className="lab-tool"><BookOpen size={14} aria-hidden="true" /> {t('Lab notes', 'Заметки')}</a>
        <button
          type="button"
          className="lab-tool lab-lang"
          lang={lang === 'en' ? 'ru' : 'en'}
          aria-label={lang === 'en' ? 'Переключить на русский' : 'Switch to English'}
          title={lang === 'en' ? 'Русский' : 'English'}
          onClick={() => setLang(lang === 'en' ? 'ru' : 'en')}
        >
          {lang === 'en' ? 'RU' : 'EN'}
        </button>
      </div>
    </header>
  );
}
export function FigureCaption({ number, children }: { number: string; children: ReactNode }) {
  return (
    <span className="fig-caption">
      <span className="fig-cross" aria-hidden="true" />
      <span className="fig-id">{t('FIG.', 'РИС.')} {number}</span>
      <i />
      {children}
    </span>
  );
}
export function LabFooter() {
  return (
    <footer className="lab-footer">
      <span>STATUM LAB</span>
      <span>{t('Monte Carlo laboratory', 'Лаборатория Монте-Карло')}</span>
    </footer>
  );
}
