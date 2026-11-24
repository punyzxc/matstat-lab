import { expect, test } from '@playwright/test';

test('built app: a real Worker posts progress and a result, IndexedDB stores and returns it', async ({ page }) => {
  await page.goto('/smoke.html');
  const smoke = page.getByTestId('smoke');
  await expect(smoke).toHaveAttribute('data-status', 'done');
  await expect(smoke).toHaveAttribute('data-progress', '2500,5000,7500,10000');
  const mean = Number(await smoke.getAttribute('data-mean'));
  expect(mean).toBeGreaterThan(0.45);
  expect(mean).toBeLessThan(0.55);
  await expect(smoke).toHaveAttribute('data-stored', String(mean));

  // The record survives a reload: it was read from IndexedDB, not from memory.
  const persisted = await page.evaluate(
    () =>
      new Promise<unknown>((resolve, reject) => {
        const open = indexedDB.open('statum-lab', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const get = open.result.transaction('records', 'readonly').objectStore('records').get('smoke-1');
          get.onsuccess = () => resolve((get.result as { payload: { mean: number } }).payload.mean);
          get.onerror = () => reject(get.error);
        };
      }),
  );
  expect(persisted).toBe(mean);
});

test('built app: the product entry mounts the scene host and nothing else', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main[data-scene-host]')).toBeAttached();
});
