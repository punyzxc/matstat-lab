import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#station/moments?seed=3&sigma=1');
  // The clean-clone Vite server compiles the scene and its kernels on the first visit.
  await expect(page.locator('.live-formula')).toBeVisible({ timeout: 15000 });
});

test('formula focus and hover link the variable to the plotted distribution with the same colour', async ({ page }) => {
  const input = page.getByRole('textbox', { name: 'Standard deviation σ, formula value' });
  const figure = page.locator('[data-live-figure="sigma"]');
  await input.hover();
  await expect(figure).toHaveAttribute('data-highlighted', 'true');
  expect(await input.evaluate(el => getComputedStyle(el).getPropertyValue('--live-variable-color')))
    .toBe(await figure.evaluate(el => getComputedStyle(el).getPropertyValue('--live-variable-color')));
  expect(await input.evaluate(el => getComputedStyle(el).color))
    .toBe(await figure.locator('.chart-series--pdf').evaluate(el => getComputedStyle(el).stroke));
  await input.focus();
  await expect(input).toHaveAccessibleDescription(/spread of the distribution/);
  await expect(page.getByRole('tooltip')).toBeVisible();
  await expect(page.locator('.live-formula-speech math')).toHaveCount(1);
});

test('a focused clean value follows an external experiment update', async ({ page }) => {
  const input = page.getByRole('textbox', { name: 'Standard deviation σ, formula value' });
  await input.focus();
  await page.evaluate(() => { location.hash = 'station/moments?seed=3&sigma=1.6'; });
  await expect(input).toHaveValue('1.6');
  await expect(page.locator('[data-live-result="variance"]')).toHaveText('2.56');
});

test('typed values clamp, rerun the kernel and finish at the exact computed variance; arrows nudge', async ({ page }) => {
  const input = page.getByRole('textbox', { name: 'Standard deviation σ, formula value' });
  await page.locator('[data-live-result="variance"]').evaluate(el => {
    window.liveFormulaFrames = [];
    new MutationObserver(() => window.liveFormulaFrames.push(Number(el.textContent))).observe(el, { childList: true, subtree: true, characterData: true });
  });
  await input.fill('999');
  await input.press('Enter');
  await expect(input).toHaveValue('3');
  await expect(page).toHaveURL(/sigma=3(&|$)/);
  const result = page.locator('[data-live-result="variance"]');
  await expect(result).toHaveText('9');
  expect(await page.evaluate(() => window.liveFormulaFrames.some(value => value > 1 && value < 9))).toBe(true);
  await input.press('ArrowDown');
  await expect(input).toHaveValue('2.9');
  await expect(result).toHaveText('8.41');
  await input.fill('no number');
  await input.press('Enter');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(result).toHaveText('8.41');
  await expect(page.locator('.live-formula .katex-error')).toHaveCount(0);
});

test('reduced motion snaps the result and Russian hints follow the selected language', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => localStorage.setItem('statum-lab:lang', 'ru'));
  await page.reload();
  const input = page.getByRole('textbox', { name: 'Стандартное отклонение σ, значение в формуле' });
  await input.focus();
  await expect(input).toHaveAccessibleDescription(/разброс распределения/);
  await input.fill('2');
  await input.press('Enter');
  await expect(page.locator('[data-live-result="variance"]')).toHaveText('4');
});
