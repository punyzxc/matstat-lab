import { expect, test } from '@playwright/test';
import { historyPrefix } from '../src/last-results.ts';

test('an orbital window shows its own saved sample and the last opened mark', async ({ page }) => {
  const snapshots = {
    convergence: { settings: { distribution: 'exponential', scale: 1.25, count: 64, seed: 25 }, size: 64 },
  };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(
    ({ prefix, runs }) => {
      for (const [id, run] of Object.entries(runs)) localStorage.setItem(prefix + id, JSON.stringify(run));
      localStorage.setItem(prefix + 'last-visited', 'convergence');
    },
    { prefix: historyPrefix, runs: snapshots },
  );
  await page.goto('/');

  const windows = page.locator('a.orbit-preview[data-module]');
  const orbitOf = { distribution: 'II Random variables', convergence: 'III Limit theorems' };
  // The last visited station's orbit opens first; the Explorer is a kernel station since #91, so the saved window is Convergence.
  await expect(page.getByRole('link', { name: 'III Limit theorems' })).toHaveAttribute('aria-current', 'true');
  for (const [id, run] of Object.entries(snapshots)) {
    await page.getByRole('link', { name: orbitOf[id] ?? 'IV Statistics' }).click();
    const window = windows.and(page.locator(`[data-module="${id}"]`));
    await expect(window).toHaveAttribute('data-saved', 'true');
    await expect(window).toHaveAttribute('data-motion', 'false');
    await expect(window).toHaveAccessibleName(
      new RegExp(`Latest result.*seed ${run.settings.seed}, ${run.size} observations`),
    );
  }
  const convergence = windows.and(page.locator('[data-module="convergence"]'));
  await expect(convergence).toHaveAccessibleName(/Last opened/);
  await convergence.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#station\/convergence$/);
});
