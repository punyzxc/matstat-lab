import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#lecture/8/1');
  await expect(page.getByTestId('lecture-story')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.story-lab .readouts')).toBeVisible({ timeout: 15000 });
});

test('keyboard and scroll select the matching live beat without leaving the lecture or pausing', async ({ page }) => {
  const lab = page.locator('.story-lab');
  await expect(lab).toHaveAttribute('data-beat', 'one-term');
  await expect(lab).toHaveAttribute('data-n', '1');
  await page.keyboard.press('PageDown');
  await expect(page).toHaveURL(/#lecture\/8\/2$/);
  await expect(lab).toHaveAttribute('data-beat', 'many-terms');
  await expect(lab).toHaveAttribute('data-n', '30');
  await expect(lab.getByRole('button', { name: 'Stop the experiment', exact: true })).toBeVisible();
  await lab.getByRole('button', { name: 'Stop the experiment', exact: true }).click();
  await page.getByTestId('story-flow').evaluate(el => { el.scrollTop = 0; });
  await expect(page).toHaveURL(/#lecture\/8\/1$/);
  await expect(lab).toHaveAttribute('data-beat', 'one-term');
  await expect(lab.getByRole('button', { name: 'Play the experiment', exact: true })).toBeVisible();
});

test('expansion preserves the station, seed and parameters; Escape restores scroll and focus', async ({ page }) => {
  const lab = page.locator('.story-lab');
  await lab.getByRole('button', { name: 'Stop the experiment', exact: true }).click();
  const seed = await lab.locator('#station-seed').inputValue();
  const params = await lab.getAttribute('data-params');
  const chart = lab.locator('.chart svg').first();
  await chart.evaluate(el => { el.dataset.sameInstance = 'yes'; });
  const flow = page.getByTestId('story-flow');
  await flow.evaluate(el => { el.scrollTop = 60; });
  const scroll = await flow.evaluate(el => el.scrollTop);
  const expand = page.getByRole('button', { name: 'Expand experiment', exact: true });
  await expand.click();
  await expect(lab).toHaveAttribute('data-expanded', 'true');
  await expect(chart).toHaveAttribute('data-same-instance', 'yes');
  await expect(lab.locator('#station-seed')).toHaveValue(seed);
  await expect(lab).toHaveAttribute('data-params', params);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement.closest('.story-controls, .story-flow')))).toBe(false);
  await page.keyboard.press('Escape');
  await expect(lab).toHaveAttribute('data-expanded', 'false');
  await expect(expand).toBeFocused();
  expect(await flow.evaluate(el => el.scrollTop)).toBeCloseTo(scroll, 0);
  await expect(page).toHaveURL(/#lecture\/8\/1$/);
});

test('deeper explanation opens alone and a what-if chip recomputes the live result', async ({ page }) => {
  const step = page.locator('[data-story-step="1"]');
  await step.getByRole('button', { name: 'Details & proof', exact: true }).click();
  await expect(step.getByRole('button', { name: 'Intuition', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(step.getByRole('region', { name: 'Details & proof', exact: true })).toContainText('finite variance');
  await step.getByRole('button', { name: 'n = 50', exact: true }).click();
  const lab = page.locator('.story-lab');
  await expect(lab).toHaveAttribute('data-n', '50');
  await expect(lab.locator('.readouts th').filter({ hasText: 'Kolmogorov distance' }).first()).toContainText(/n\s*=\s*50/);
});

test('Explore makes every declared parameter typeable and Demo restores the tuned beat', async ({ page }) => {
  const lab = page.locator('.story-lab');
  await expect(lab.locator('.parameters')).toBeHidden();
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(lab).toHaveAttribute('data-expanded', 'true');
  const typed = lab.locator('.parameters .range-typed');
  await expect(typed).toHaveCount(4);
  for (const field of await typed.all()) await expect(field).toBeVisible();
  const n = lab.locator('.range-field').filter({ has: page.locator('#p-n') }).locator('.range-typed');
  await n.fill('20');
  await n.press('Enter');
  await expect(lab.locator('.readouts th').filter({ hasText: 'Kolmogorov distance' }).first()).toContainText(/n\s*=\s*20/);
  await page.getByRole('button', { name: 'Demo', exact: true }).click();
  await expect(lab).toHaveAttribute('data-n', '1');
  await expect(lab.locator('.parameters')).toBeHidden();
});

test('Russian story controls translate and the document fits a narrow viewport', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('statum-lab:lang', 'ru'));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Исследование', exact: true })).toBeVisible();
  await expect(page.locator('[data-story-step="1"]')).toContainText('Интуиция');
  await page.setViewportSize({ width: 700, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await expect(page.getByRole('button', { name: 'Развернуть эксперимент', exact: true })).toBeVisible();
});

test('a what-if patch preserves the immediately preceding typed edit', async ({ page }) => {
  const lab = page.locator('.story-lab');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  const n = lab.locator('.range-field').filter({ has: page.locator('#p-n') }).locator('.range-typed');
  await n.fill('20');
  await n.press('Enter');
  await page.keyboard.press('Escape');
  await page.locator('[data-story-step="1"]').getByRole('button', { name: 'Uniform law', exact: true }).click();
  await expect(lab).toHaveAttribute('data-n', '20');
  await expect(lab.locator('.readouts th').filter({ hasText: 'Kolmogorov distance' }).first()).toContainText(/n\s*=\s*20/);
  expect(JSON.parse(await lab.getAttribute('data-params')).law).toBe(0);
});

test('reduced motion retains the existing stopped-by-default playback policy on every beat', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  const lab = page.locator('.story-lab');
  await expect(lab.getByRole('button', { name: 'Play the experiment', exact: true })).toBeVisible();
  await page.keyboard.press('PageDown');
  await expect(lab).toHaveAttribute('data-beat', 'many-terms');
  await expect(lab.getByRole('button', { name: 'Play the experiment', exact: true })).toBeVisible();
});
