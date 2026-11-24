import { expect, test } from '@playwright/test';

// #37: the program is one scene. Stations, notes and the sample record open inside it.
const views = [
  '#orbit/probability',
  '#orbit/variables',
  '#orbit/limits',
  '#orbit/statistics',
  '#station/distribution',
  '#station/convergence',
  '#station/estimation',
  '#station/confidence',
  '#station/testing',
  '#station/randomness',
  '#station/urn',
  '#station/bayes',
  '#station/clt',
  '#station/fit',
  '#notes',
  '#record',
];

test('no view scrolls the document at 1280×720, and the globe and orbit switcher stay visible', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const hash of views) {
    await page.goto('/' + hash);
    await expect(page.getByRole('navigation', { name: 'Lecture orbits' })).toBeVisible();
    await expect(page.getByRole('img', { name: /Earth point cloud/ })).toBeVisible();
    const fits = await page.evaluate(() => document.scrollingElement.scrollHeight <= window.innerHeight);
    expect(fits, hash).toBe(true);
  }
});

test('the header has no separate views: orbits switch in place and tools open as drawers', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const orbits = page.getByRole('navigation', { name: 'Lecture orbits' });
  await expect(orbits.getByRole('link')).toHaveCount(4);
  await orbits.getByRole('link', { name: 'I Probability' }).click();
  await expect(page).toHaveURL(/#orbit\/probability$/);
  await expect(page.locator('.orbit-node')).toHaveCount(5);
  await page.getByRole('link', { name: 'Sample record' }).click();
  await expect(page.getByTestId('drawer-record')).toBeVisible();
  await expect(page.locator('.orbit-node')).toHaveCount(5);
});

test('a station link reopens the same station, seed and parameters in a fresh tab', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/bayes?seed=17&p=0.25');
  await expect(page.getByRole('heading', { name: 'Bayes', exact: true })).toBeVisible();
  const fresh = await context.newPage();
  await fresh.goto(page.url());
  await expect(fresh.getByTestId('station-dock')).toBeVisible();
  await expect(fresh).toHaveTitle(/^Bayes/);
});

test('keyboard: Enter opens a station, Escape closes it and focus returns to its card', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#orbit/probability');
  for (const name of ['Urn', 'Frequency', 'Darts', 'Bayes', 'Bernoulli']) {
    const card = page.locator('.orbital-nodes').getByRole('link', { name: new RegExp('^' + name) });
    await card.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('station-dock')).toBeVisible();
    await expect(page.locator('#dock-title')).toBeFocused();
    await expect(page.locator('.orbital-nodes')).toHaveAttribute('inert', '');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('station-dock')).toHaveCount(0);
    await expect(card).toBeFocused();
  }
});

test('legacy prototype links still resolve inside the scene', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#module/estimation');
  await expect(page.getByTestId('station-dock')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Estimation', exact: true })).toBeVisible();
  await page.goto('/#workspace');
  await expect(page.getByRole('button', { name: 'Run simulation' })).toBeVisible();
});

test('reduced motion: the dock opens without animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/urn');
  const animation = await page.getByTestId('station-dock').evaluate((n) => getComputedStyle(n).animationName);
  expect(animation).toBe('none');
});
