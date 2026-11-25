import { expect, test } from '@playwright/test';

// #130: typed n and k rebuild every construction while there are at most 120; above that only the exact count.
test('Combinatorics: constructions rebuild live, hover highlights, large values show the exact count', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/combinatorics?seed=3&scheme=1&n=4&k=2');
  const dock = page.getByTestId('station-dock');
  const box = dock.getByRole('region', { name: 'Constructions', exact: true });
  await expect(box.locator('.cx-item')).toHaveCount(12);
  await expect(dock.getByRole('group', { name: 'Live formula' })).toContainText('=12');

  // Hovering an object lights every construction that uses it: 6 of the 12 arrangements of 4 by 2 contain a.
  await box.getByRole('button', { name: 'object a' }).hover();
  await expect(box.locator('.cx-item[data-on]')).toHaveCount(6);
  await box.getByRole('button', { name: /places/ }).hover();
  await expect(box).toHaveAttribute('data-focus', 'k');

  await dock.getByRole('radio', { name: 'combinations', exact: true }).click();
  await expect(box.locator('.cx-item')).toHaveCount(6);
  const n = dock.getByLabel(/Objects n, typed value/);
  await n.fill('25');
  await n.press('Enter');
  await expect(box.locator('.cx-count')).toHaveAttribute('data-count', '300');
  await expect(box.locator('.cx-item')).toHaveCount(12); // sampled only

  await dock.getByRole('radio', { name: 'permutations', exact: true }).click();
  await expect(box.locator('.cx-count')).toHaveAttribute('data-count', '15511210043330985984000000');
  await expect(dock.getByRole('group', { name: 'Live formula' })).toContainText('25!');
});

test('Combinatorics opens on the main scene from the lecture 1 step', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#lecture/1/7');
  await page.getByRole('link', { name: /Open the Combinatorics station/ }).click();
  await expect(page).toHaveURL(/#station\/combinatorics\?seed=130&scheme=1&n=4&k=2&lecture=1&step=7$/);
  await expect(page.getByTestId('station-dock')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Combinatorics' })).toBeVisible();
  // It stays off the globe: orbit I keeps its six stations.
  await page.goto('/#orbit/probability');
  await expect(page.locator('.orbit-node')).toHaveCount(6);
});
