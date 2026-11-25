import { expect, test } from '@playwright/test';

// The lab speaks Russian by default; the EN switch in the top bar changes the language at once, without a reload.
test.use({ storageState: { cookies: [], origins: [] } });

/** Latin words a Russian screen shows outside formulas, code and ASCII art. */
async function englishOnScreen(page) {
  return page.evaluate(() => {
    const skip = '.katex, code, pre, kbd, [translate="no"], script, style, .sr-only, .portrait-placeholder';
    const words = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode())
      if (!n.parentElement?.closest(skip)) for (const w of n.textContent.match(/[A-Za-z]{3,}/g) ?? []) words.add(w);
    // Roman numerals name the orbits (I–IV).
    return [...words].filter((w) => !/^[IVX]+$/.test(w) && !['STATUM', 'LAB', 'ASCII', 'CSV', 'Esc', 'Enter', 'Shift', 'Natural', 'Earth'].includes(w));
  });
}

test('the lab opens in Russian, and EN switches to English and back at once', async ({ page }) => {
  await page.goto('/#orbit/probability');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Орбитальная лаборатория');
  const toEnglish = page.getByRole('button', { name: 'Switch to English' });
  await expect(toEnglish).toHaveText('EN');
  await toEnglish.click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Orbital laboratory');
  await expect(page.getByRole('navigation', { name: 'Lecture orbits' })).toContainText('Probability');
  // The choice is remembered.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Orbital laboratory');
  await page.getByRole('button', { name: 'Переключить на русский' }).click();
  await expect(page.getByRole('navigation', { name: 'Орбиты лекций' })).toContainText('Вероятность');
});

test('switching the language keeps an open station and its run', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/clt?seed=4242');
  const dock = page.getByTestId('station-dock');
  await expect(dock.getByRole('heading', { name: 'ЦПТ' })).toBeVisible();
  await expect(dock.getByRole('table', { name: 'Показания' })).toBeVisible();
  const before = await dock.getByRole('table').locator('tbody td').first().textContent();
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(dock.getByRole('heading', { name: 'CLT' })).toBeVisible();
  await expect(dock.getByRole('table', { name: 'Readouts' })).toBeVisible();
  expect(await page.evaluate(() => location.hash)).toMatch(/^#station\/clt\?seed=4242/);
  // Same draw, now with a decimal point instead of the Russian decimal comma.
  const after = await dock.getByRole('table').locator('tbody td').first().textContent();
  expect(after).toBe(before.replace(/,/g, '.').replace(/ /g, ','));
});

const views = [
  '#orbit/probability', '#orbit/variables', '#orbit/limits', '#orbit/statistics',
  '#station/distribution', '#station/convergence', '#station/estimation', '#station/confidence', '#station/testing',
  '#station/homogeneity', '#station/urn', '#station/frequency', '#station/darts', '#station/bayes', '#station/moments',
  '#station/transform', '#station/scatter', '#station/convolution', '#station/lln', '#station/clt', '#station/sample',
  '#station/fit', '#notes', '#record', '#lectures', '#lecture/1/2', '#lecture/7/1', '#lecture/12/1',
];

test('every Russian view fits 1280×720 and shows no English words', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const found = [];
  for (const hash of views) {
    await page.goto('/' + hash);
    await expect(page.getByRole('navigation', { name: 'Орбиты лекций' })).toBeVisible();
    // Kernel stations compute in a worker: wait for the first readouts.
    if (hash.startsWith('#station/') && !/distribution|convergence|estimation$|confidence|testing|urn/.test(hash))
      await expect(page.getByRole('table', { name: 'Показания' })).toBeVisible({ timeout: 15000 });
    const fits = await page.evaluate(() => document.scrollingElement.scrollHeight <= window.innerHeight);
    expect(fits, hash).toBe(true);
    const left = await englishOnScreen(page);
    if (left.length) found.push(`${hash}: ${left.join(', ')}`);
  }
  expect(found).toEqual([]);
});
