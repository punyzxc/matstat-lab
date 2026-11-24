import { expect, test } from '@playwright/test';
import { moduleReadout } from '../src/method-readouts.ts';
import { collect, histogram, sources } from '../src/statistics.ts';
import { historyPrefix } from '../src/last-results.ts';

test('orbital previews use independent saved samples and label unsaved sample previews', async ({ page }) => {
  const snapshots = {
    distribution: { settings: { distribution: 'exponential', scale: 1.25, count: 64, seed: 25 }, size: 64 },
    convergence: { settings: { distribution: 'uniform', scale: 1.5, count: 128, seed: 63 }, size: 19 },
    estimation: { settings: { distribution: 'normal', scale: 1, count: 64, seed: 81 }, size: 33 },
    confidence: { settings: { distribution: 'uniform', scale: 1, count: 64, seed: 31 }, size: 20 },
    testing: { settings: { distribution: 'exponential', scale: 2, count: 64, seed: 47 }, size: 29 },
  };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(
    ({ prefix, runs }) => {
      for (const [id, run] of Object.entries(runs)) localStorage.setItem(prefix + id, JSON.stringify(run));
      localStorage.setItem(prefix + 'last-visited', 'confidence');
    },
    { prefix: historyPrefix, runs: snapshots },
  );
  await page.goto('/');

  const windows = page.locator('a.orbit-preview[data-module]');
  const orbitOf = { distribution: 'II Random variables', convergence: 'III Limit theorems' };
  await expect(page.getByRole('link', { name: 'IV Statistics' })).toHaveAttribute('aria-current', 'true');
  for (const [id, run] of Object.entries(snapshots)) {
    await page.getByRole('link', { name: orbitOf[id] ?? 'IV Statistics' }).click();
    const window = windows.and(page.locator(`[data-module="${id}"]`));
    await expect(window).toHaveAttribute('data-saved', 'true');
    await expect(window).toHaveAttribute('data-motion', 'false');
    await expect(window).toHaveAccessibleName(
      new RegExp(`Latest result.*seed ${run.settings.seed}, ${run.size} observations`),
    );
    const sample = collect(run.settings).slice(0, run.size);
    if (id === 'distribution') {
      const bins = histogram(sample, sources.exponential.domain(run.settings.scale), 18);
      await expect(window.locator('.orbit-preview-chart')).toHaveAccessibleName(
        new RegExp('Bin counts: ' + bins.counts.join(', ')),
      );
    }
    if (id === 'testing') {
      const probability = moduleReadout(id, sample, run.settings).value;
      await expect(window.locator('.orbit-preview-value')).toHaveText(probability);
    }
  }
  await page.getByRole('link', { name: 'IV Statistics' }).click();
  const lastOpened = windows.and(page.locator('[data-module="confidence"]'));
  await expect(lastOpened).toHaveAccessibleName(/Last opened/);
  const randomness = windows.and(page.locator('[data-module="randomness"]'));
  await expect(randomness).toHaveAttribute('data-saved', 'false');
  await expect(randomness).toHaveAccessibleName(/Randomness.*Seeded preview/);
  await randomness.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#station\/randomness$/);
});
