import { decode, requireSnapshot } from './snapshot.mjs';

const storeName = 'completed-experiments';

export function openJournal(name = 'statum-discovery-snapshots') {
  return new Promise((resolve, reject) => {
    let wasBlocked = false;
    const open = indexedDB.open(name, 1);
    open.onupgradeneeded = () => {
      const records = open.result.createObjectStore(storeName, { keyPath: 'id' });
      records.createIndex('module', 'moduleId');
    };
    open.onblocked = () => {
      wasBlocked = true;
      reject(new Error('journal-upgrade-blocked'));
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      if (wasBlocked) { db.close(); return; }
      db.onversionchange = () => db.close();
      resolve(createJournal(db));
    };
  });
}

function createJournal(db) {
  function run(mode, schedule) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      let value, failure;
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('journal-aborted'));
      const fail = error => { failure = error; tx.abort(); };
      const capture = request => {
        request.onsuccess = () => { value = request.result; };
      };
      try {
        schedule(tx.objectStore(storeName), capture, fail);
      } catch (error) {
        fail(error);
      }
    });
  }

  return {
    save(input) {
      const snapshot = requireSnapshot(input);
      return run('readwrite', (store, capture) => capture(store.add(snapshot)));
    },
    async latest(moduleId) {
      const stored = await run('readonly', (store, capture) => capture(store.index('module').getAll(moduleId)));
      let snapshot, unreadable = 0;
      for (const record of stored) {
        const decoded = decode(record);
        if (!decoded.ok) { unreadable++; continue; }
        const candidate = decoded.snapshot;
        if (!snapshot || candidate.finishedAt > snapshot.finishedAt ||
            (candidate.finishedAt === snapshot.finishedAt && candidate.id > snapshot.id)) snapshot = candidate;
      }
      return { snapshot: snapshot ?? null, unreadable };
    },
    rename(id, name) {
      return run('readwrite', (store, capture, fail) => {
        const read = store.get(id);
        read.onsuccess = () => {
          try {
            const existing = requireSnapshot(read.result);
            capture(store.put(requireSnapshot({ ...existing, name })));
          } catch (error) {
            fail(error);
          }
        };
      });
    },
    remove(id) {
      return run('readwrite', (store, capture) => capture(store.delete(id)));
    },
    close() { db.close(); },
  };
}
