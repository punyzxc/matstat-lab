import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { oldFixture, storedRun } from './fixture.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assets = new Set(['/journal.mjs', '/snapshot.mjs']);

test('real browser journal restores a completed snapshot and handles mutations across tabs', async t => {
  const server = createServer(async (req, res) => {
    try {
      if (req.url === '/') return res.writeHead(200, { 'Content-Type': 'text/html' }).end('<title>Journal fixture</title>');
      if (!assets.has(req.url)) return res.writeHead(404).end();
      const data = await readFile(new URL('.' + req.url, import.meta.url));
      res.writeHead(200, { 'Content-Type': 'text/javascript' }).end(data);
    } catch {
      res.writeHead(500).end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
  t.after(() => browser.close());
  const origin = 'http://127.0.0.1:' + server.address().port;
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(origin);
  const missing = await page.evaluate(async () => {
    const { openJournal } = await import('/journal.mjs');
    const journal = await openJournal();
    const result = await journal.latest('distribution');
    journal.close();
    return result;
  });
  assert.deepEqual(missing, { snapshot: null, unreadable: 0 });

  await page.evaluate(async original => {
    const { openJournal } = await import('/journal.mjs');
    const journal = await openJournal();
    await journal.save(original);
    journal.close();
  }, storedRun);
  await page.reload();
  const rehydrated = await page.evaluate(async () => {
    const { openJournal } = await import('/journal.mjs');
    const journal = await openJournal();
    const result = await journal.latest('distribution');
    journal.close();
    return result;
  });
  assert.deepEqual(rehydrated.snapshot, storedRun);
  assert.equal(rehydrated.unreadable, 0);

  const otherTab = await context.newPage();
  await otherTab.goto(origin);
  const legacy = { ...oldFixture(), id: 'experiment-002' };
  await otherTab.evaluate(async ({ older, original }) => {
    const stored = indexedDB.open('statum-discovery-snapshots');
    await new Promise((resolve, reject) => {
      stored.onerror = () => reject(stored.error);
      stored.onsuccess = () => {
        const db = stored.result;
        const tx = db.transaction('completed-experiments', 'readwrite');
        const store = tx.objectStore('completed-experiments');
        store.add(older);
        store.add({ ...original, schemaVersion: 9, id: 'experiment-003' });
        store.add({ ...original, id: 'experiment-004', series: null });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    });
  }, { older: legacy, original: storedRun });

  const result = await page.evaluate(async original => {
    const { openJournal } = await import('/journal.mjs');
    const { exportJson, exportCsv } = await import('/snapshot.mjs');
    const journal = await openJournal();
    const latest = await journal.latest('distribution');
    const rejected = await journal.save(original).then(() => null, error => error.name);
    await journal.rename(latest.snapshot.id, 'Reviewed sample');
    const renamed = await journal.latest('distribution');
    await journal.remove(renamed.snapshot.id);
    const fallback = await journal.latest('distribution');
    const others = await journal.latest('convergence');
    journal.close();
    return { latest, renamed, fallback, others, rejected, json: exportJson(fallback.snapshot), csv: exportCsv(fallback.snapshot) };
  }, storedRun);
  assert.equal(result.latest.snapshot.id, legacy.id);
  assert.equal(result.latest.snapshot.schemaVersion, 1);
  assert.equal(result.latest.unreadable, 2);
  assert.equal(result.renamed.snapshot.name, 'Reviewed sample');
  assert.equal(result.renamed.snapshot.finishedAt, storedRun.finishedAt);
  assert.deepEqual(result.fallback.snapshot, storedRun);
  assert.equal(result.fallback.unreadable, 2);
  assert.equal(result.rejected, 'ConstraintError');
  assert.deepEqual(result.others, { snapshot: null, unreadable: 0 });
  assert.deepEqual(JSON.parse(result.json), storedRun);
  assert.deepEqual(result.csv.trimEnd().split('\r\n').slice(1).map(row => Number(row.split(',').at(-1))), storedRun.retained.values);
});
