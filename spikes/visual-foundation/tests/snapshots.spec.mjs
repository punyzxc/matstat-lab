import { expect, test } from '@playwright/test';

// #114: snapshots. S saves the draw on screen; its ghost lies under the live chart in its own colour, with what it
// differs in on the legend; the address keeps it; restore reruns it exactly; at most four.
const URL = '/#station/fit?seed=7&view=0&law=0&h0=0&n=10&reps=0';

test('Snapshots: S saves n = 10, its ghost stays under n = 1000, survives reload, hides, restores and goes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(URL);
  const dock = page.getByTestId('station-dock');
  const strip = dock.getByRole('group', { name: 'Snapshots' });
  await expect(dock.getByRole('table', { name: 'Readouts' })).toBeVisible();
  const stop = dock.getByRole('button', { name: 'Stop the experiment' });
  if (await stop.count()) await stop.click();

  await page.locator('body').focus();
  await page.keyboard.press('s');
  const chipA = strip.getByRole('button', { name: 'Snapshot A on the chart' });
  await expect(chipA).toHaveAttribute('aria-pressed', 'true');

  const n = dock.getByLabel('Sample size n, typed value');
  await n.fill('1000');
  await n.press('Enter');
  const chart = dock.locator('.chart-stage .chart').first();
  await expect(chart.locator('.chart-series.tone-ghost-a')).toHaveCount(1);
  const keyA = chart.locator('.chart-key.tone-ghost-a');
  await expect(keyA).toContainText('A · ');
  await expect(keyA).toContainText('= 10 · seed 7');
  await expect(keyA.locator('.katex')).toHaveCount(1); // n typeset, as in the notebook
  await expect(page).toHaveURL(/snap=A7~[^&]*n:10/, { timeout: 5000 });

  // The address carries it: a reload replays the same ghost.
  const ghostPath = await chart.locator('.chart-series.tone-ghost-a').getAttribute('d');
  await page.reload();
  await expect(chipA).toBeVisible();
  await expect(chart.locator('.chart-series.tone-ghost-a')).toHaveAttribute('d', ghostPath);

  // A second snapshot gets its own colour.
  const seed = dock.getByLabel('Random seed');
  await seed.fill('8');
  await seed.press('Enter'); // leaves the field, so S is a shortcut again
  await page.keyboard.press('s');
  await expect(strip.getByRole('button', { name: 'Snapshot B on the chart' })).toBeVisible();
  await n.fill('500');
  await n.press('Enter');
  await expect(chart.locator('.chart-series.tone-ghost-b')).toHaveCount(1);
  const colours = await chart.locator('.chart-series[class*="tone-ghost-"]').evaluateAll((els) => els.map((e) => getComputedStyle(e).stroke));
  expect(new Set(colours).size).toBe(2);

  // Hide, show.
  await chipA.click();
  await expect(chipA).toHaveAttribute('aria-pressed', 'false');
  await expect(chart.locator('.chart-series.tone-ghost-a')).toHaveCount(0);
  await expect(page).toHaveURL(/snap=-A7/, { timeout: 5000 });
  await chipA.click();
  await expect(chart.locator('.chart-series.tone-ghost-a')).toHaveCount(1);

  // Restore: exactly its parameters and seed.
  await strip.getByRole('button', { name: 'Restore snapshot A' }).click();
  await expect(n).toHaveValue('10');
  await expect(seed).toHaveValue('7');
  await expect(page).toHaveURL(/[?&]seed=7&/, { timeout: 5000 });

  // Remove.
  await strip.getByRole('button', { name: 'Remove snapshot A' }).click();
  await expect(chipA).toHaveCount(0);
  await expect(page).not.toHaveURL(/snap=-?A/, { timeout: 5000 });
});

test('Snapshots: four at most, and one from another view says so instead of drawing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${URL}&snap=A1~n:10&snap=B2~n:20&snap=C3~n:30&snap=D4~n:40~view:1`);
  const dock = page.getByTestId('station-dock');
  const strip = dock.getByRole('group', { name: 'Snapshots' });
  await expect(strip.locator('.snap-chip')).toHaveCount(4);
  await expect(strip.getByRole('button', { name: 'Take a snapshot of this draw' })).toBeDisabled();
  await expect(strip.locator('.snap-chip[data-slot="d"]')).toContainText('other view');
  const chart = dock.locator('.chart-stage .chart').first();
  await expect(chart.locator('.chart-series[class*="tone-ghost-"]')).toHaveCount(3);
  await expect(chart.locator('.chart-series.tone-ghost-d')).toHaveCount(0);
});
