/** Minimal IndexedDB journal: one object store keyed by record id. Raw IDB, no wrapper library. */
export type JournalRecord = { id: string; module: string; createdAt: string; payload: unknown };

const STORE = 'records';

export function openJournal(name = 'statum-lab', factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function putRecord(db: IDBDatabase, record: JournalRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const request = tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    // A failed request bubbles to the transaction before tx.error is set, so prefer the request's own error.
    tx.onerror = () => reject(request.error ?? tx.error ?? new Error('journal write failed'));
    tx.onabort = () => reject(tx.error ?? request.error ?? new Error('journal write aborted'));
  });
}

export function getRecord(db: IDBDatabase, id: string): Promise<JournalRecord | undefined> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result as JournalRecord | undefined);
    request.onerror = () => reject(request.error);
  });
}
