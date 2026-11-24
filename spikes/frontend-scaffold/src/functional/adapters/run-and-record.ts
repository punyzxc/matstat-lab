import { getRecord, openJournal, putRecord, type JournalRecord } from '../research-data/journal/journal';
import { runInWorker } from '../simulation/worker/client';
import type { RunSpec } from '../simulation/worker/protocol';

/** The only place UI code meets the functional packages: run in a Worker, commit to the journal, read it back. */
export async function runAndRecord(spec: RunSpec, onProgress?: (done: number, total: number) => void) {
  const result = await runInWorker(spec, onProgress);
  const db = await openJournal();
  try {
    const record: JournalRecord = { id: spec.id, module: 'smoke', createdAt: new Date().toISOString(), payload: result };
    await putRecord(db, record);
    return { result, stored: await getRecord(db, spec.id) };
  } finally {
    db.close();
  }
}
