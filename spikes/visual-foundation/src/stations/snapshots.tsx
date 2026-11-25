import { Camera, Undo2, X } from 'lucide-react';
import { MathText } from '../math';
import { t } from '../i18n';
import type { Snap } from './snapshot-math.mjs';

export type SnapView = Snap & { desc: string; elsewhere: boolean; failed: boolean };

/**
 * Snapshots (#114): save the draw on screen, then lay it over the live chart as a coloured ghost.
 * Each chip toggles its ghost, restores its exact parameters and seed, or removes it.
 */
export function SnapshotStrip({ snaps, canTake, full, onTake, onToggle, onRestore, onRemove }: {
  snaps: SnapView[]; canTake: boolean; full: boolean;
  onTake: () => void; onToggle: (slot: string) => void; onRestore: (slot: string) => void; onRemove: (slot: string) => void;
}) {
  return (
    <div className="snap-strip" role="group" aria-label={t('Snapshots', 'Снимки')}>
      <button type="button" className="snap-take" onClick={onTake} disabled={!canTake || full}
        aria-label={t('Take a snapshot of this draw', 'Сделать снимок этого прогона')}
        title={full ? t('Four snapshots at most: remove one to take another', 'Не больше четырёх снимков: удалите один, чтобы сделать новый')
          : t('Save this draw and lay it over the live one (S)', 'Сохранить этот прогон и наложить его на живой (S)')}>
        <Camera size={14} aria-hidden /> <span>{t('Snapshot', 'Снимок')}</span> <kbd aria-hidden>S</kbd>
      </button>
      {snaps.length === 0 && (
        <span className="snap-hint">{t('Save a draw, change a parameter, and see both: n = 10 against n = 1000.', 'Сохраните прогон, измените параметр и смотрите оба сразу: n = 10 против n = 1000.')}</span>
      )}
      {snaps.map((s) => (
        <span key={s.slot} className="snap-chip" data-slot={s.slot.toLowerCase()} data-hidden={s.hidden || undefined} data-elsewhere={s.elsewhere || undefined}>
          <button type="button" className="snap-toggle" aria-pressed={!s.hidden}
            aria-label={t(`Snapshot ${s.slot} on the chart`, `Снимок ${s.slot} на графике`)}
            title={s.failed ? t('The kernel rejected these parameters', 'Ядро отклонило эти параметры')
              : s.elsewhere ? t('Taken in another view: restore it to see it', 'Снят в другом виде: восстановите, чтобы увидеть')
              : s.hidden ? t('Show on the chart', 'Показать на графике') : t('Hide from the chart', 'Убрать с графика')}
            onClick={() => onToggle(s.slot)}>
            <i aria-hidden /> <b>{s.slot}</b> <span className="snap-desc"><MathText text={s.desc} /></span>
            {s.elsewhere && <small>{t('other view', 'другой вид')}</small>}
          </button>
          <button type="button" className="snap-icon" onClick={() => onRestore(s.slot)}
            aria-label={t(`Restore snapshot ${s.slot}`, `Восстановить снимок ${s.slot}`)} title={t('Rerun with exactly these parameters and seed', 'Перезапустить ровно с этими параметрами и зерном')}>
            <Undo2 size={13} aria-hidden />
          </button>
          <button type="button" className="snap-icon" onClick={() => onRemove(s.slot)}
            aria-label={t(`Remove snapshot ${s.slot}`, `Удалить снимок ${s.slot}`)} title={t('Remove', 'Удалить')}>
            <X size={13} aria-hidden />
          </button>
        </span>
      ))}
    </div>
  );
}
