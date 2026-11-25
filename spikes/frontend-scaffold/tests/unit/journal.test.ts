import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { getRecord, openJournal, putRecord } from '../../src/functional/research-data/journal/journal';

// fake-indexeddb is an in-memory IndexedDB for Node. The browser's real IndexedDB is covered by tests/e2e/smoke.spec.ts.
describe('research-data journal', () => {
  it('writes a record and reads the same record back after reopening', async () => {
    const factory = new IDBFactory();
    const record = { id: 'run-1', module: 'smoke', createdAt: '2026-11-24T00:00:00.000Z', payload: { mean: 0.5 } };
    const first = await openJournal('t', factory);
    await putRecord(first, record);
    first.close();
    const second = await openJournal('t', factory);
    expect(await getRecord(second, 'run-1')).toEqual(record);
    expect(await getRecord(second, 'missing')).toBeUndefined();
    second.close();
  });
});
