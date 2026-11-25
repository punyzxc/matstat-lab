import { ArrowUpRight } from 'lucide-react';
import type { KernelStation } from './catalog';
import { kernelAvailable } from './kernel-station';
import { stationHash } from './route';
import { MathText, mathToPlain } from '../math';

/** The orbit card for a lecture station; same frame as the prototype's instrument previews. */
export function StationCard({ station, active }: { station: KernelStation; active: boolean }) {
  const ready = kernelAvailable(station.kernel);
  return (
    <a
      href={stationHash(station.id)}
      className="orbit-preview station-card"
      data-active={active}
      data-ready={ready}
      aria-label={`${station.name}. Lecture ${station.lectures}. ${ready ? 'Ready.' : `Kernel in progress, issue ${station.issue}.`} ${mathToPlain(station.summary)}`}
    >
      <span className="orbit-preview-head">
        <span className="orbit-preview-label">{station.name}</span>
        <ArrowUpRight className="orbit-preview-arrow" size={14} aria-hidden="true" />
      </span>
      <span className="station-card-summary"><MathText text={station.summary} /></span>
      <span className="orbit-preview-provenance">
        <span>{ready ? 'Seeded kernel' : `Kernel · #${station.issue}`}</span>
        <span>Lecture {station.lectures}</span>
      </span>
    </a>
  );
}
