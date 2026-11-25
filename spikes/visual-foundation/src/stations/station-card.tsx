import { ArrowUpRight } from 'lucide-react';
import type { KernelStation } from './catalog';
import { kernelAvailable } from './kernel-station';
import { stationHash } from './route';
import { MathText, mathToPlain } from '../math';
import { t } from '../i18n';

/** The orbit card for a lecture station; same frame as the prototype's instrument previews. */
export function StationCard({ station, active }: { station: KernelStation; active: boolean }) {
  const ready = kernelAvailable(station.kernel);
  return (
    <a
      href={stationHash(station.id)}
      className="orbit-preview station-card"
      data-active={active}
      data-ready={ready}
      aria-label={t(`${station.name}. Lecture ${station.lectures}. ${ready ? 'Ready.' : `Kernel in progress, issue ${station.issue}.`} ${mathToPlain(station.summary)}`, `${station.name}. ${station.lectures}. ${ready ? 'Готова.' : `Ядро в работе, задача ${station.issue}.`} ${mathToPlain(station.summary)}`)}
    >
      <span className="orbit-preview-head">
        <span className="orbit-preview-label">{station.name}</span>
        <ArrowUpRight className="orbit-preview-arrow" size={14} aria-hidden="true" />
      </span>
      <span className="station-card-summary"><MathText text={station.summary} /></span>
      <span className="orbit-preview-provenance">
        <span>{ready ? t('Seeded kernel', 'Ядро с зерном') : t(`Kernel · #${station.issue}`, `Ядро · #${station.issue}`)}</span>
        <span>{t(`Lecture ${station.lectures}`, station.lectures)}</span>
      </span>
    </a>
  );
}
