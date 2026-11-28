import { expect, test } from '@playwright/test';

// #50: interactive lectures inside the scene — drawer, step player, experiment links, presenter mode, portraits.
const fits = (page) => page.evaluate(() => document.scrollingElement.scrollHeight <= window.innerHeight);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('"Lectures" in the header opens a quiet drawer with the 12 lectures inside the scene', async ({ page }) => {
  await page.goto('/#orbit/probability');
  await page.getByRole('link', { name: 'Lectures' }).click();
  await expect(page).toHaveURL(/#lectures$/);
  const drawer = page.getByTestId('drawer-lectures');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('list', { name: 'Lectures' }).getByRole('listitem')).toHaveCount(12);
  await expect(page.getByRole('navigation', { name: 'Lecture orbits' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Earth point cloud/ })).toBeVisible();
  expect(await fits(page)).toBe(true);
  await drawer.getByRole('link', { name: /L03/ }).click();
  await expect(page).toHaveURL(/#lecture\/3\/1$/);
  await expect(page.getByTestId('lecture-player')).toBeVisible();
});

test('a lecture shows one step at a time; arrows and buttons move between steps and the hash follows', async ({ page }) => {
  await page.goto('/#lecture/3/1');
  const player = page.getByTestId('lecture-player');
  await expect(player.getByRole('heading', { level: 3 })).toHaveText('Bernoulli formula');
  // Formulas are typeset (KaTeX), with the TeX source kept in MathML for screen readers.
  const formula = player.getByTestId('lecture-formula');
  await expect(formula.locator('.katex-display')).toHaveCount(2);
  await expect(formula.locator('.katex-html .mfrac, .katex-html .msupsub').first()).toBeVisible();
  await expect(formula.locator('annotation').first()).toHaveText(/P_n\(k\) = C_n\^k/);
  const example = player.getByRole('region', { name: 'Worked example' });
  await expect(example).toContainText('0.2461');
  await expect(example.locator('annotation').filter({ hasText: 'C_{10}^5' })).toHaveCount(1);
  await expect(page.getByTestId('step-counter')).toHaveText('Step 1 / 12');
  expect(await fits(page)).toBe(true);

  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/#lecture\/3\/2$/);
  await expect(player.getByRole('heading', { level: 3 })).toHaveText('Each term vanishes, the sum stays 1');
  await player.getByRole('button', { name: 'Next step' }).click();
  await expect(page).toHaveURL(/#lecture\/3\/3$/);
  await page.keyboard.press('End');
  await expect(page).toHaveURL(/#lecture\/3\/12$/);
  await expect(player.getByRole('button', { name: 'Next step' })).toBeDisabled();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('step-counter')).toHaveText('Step 11 / 12');

  // The hash alone reopens the step; an out-of-range step lands on the last one.
  await page.goto('/#lecture/3/2');
  await expect(page.getByTestId('step-counter')).toHaveText('Step 2 / 12');
  await page.goto('/#lecture/3/99');
  await expect(page).toHaveURL(/#lecture\/3\/12$/);
  await page.goto('/#lecture/3/abc');
  await expect(page).toHaveURL(/#lecture\/3\/1$/);
  await page.goto('/#lecture/3');
  await expect(page).toHaveURL(/#lecture\/3\/1$/);
});

test('"Open experiment" opens the station with the step\'s seed and parameters; "Back to lecture" returns to the step', async ({ page }) => {
  await page.goto('/#lecture/5/3');
  await page.getByRole('link', { name: /Open experiment/ }).click();
  await expect(page).toHaveURL(/#station\/distribution\?seed=506&dist=2&n=1024&scale=1&lecture=5&step=3$/);
  const dock = page.getByTestId('station-dock');
  // The Explorer is a kernel station since #91: the step's old `dist` and `scale` read as its law and parameters.
  await expect(dock.getByRole('radio', { name: 'exponential' })).toHaveAttribute('aria-checked', 'true');
  await expect(dock.locator('#station-seed')).toHaveValue('506');
  await expect(dock.locator('#p-n')).toHaveValue('1024');
  await dock.getByRole('link', { name: 'Back to lecture 5, step 3' }).click();
  await expect(page).toHaveURL(/#lecture\/5\/3$/);
  await expect(page.getByTestId('step-counter')).toHaveText('Step 3 / 4');

  // Escape from a station opened by a lecture also goes back to that step.
  await page.goto('/#lecture/7/2');
  await page.getByRole('link', { name: /Watch the running mean/ }).click();
  await expect(page).toHaveURL(/#station\/convergence\?seed=707&dist=1&n=2048&scale=1&lecture=7&step=2$/);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#lecture\/7\/2$/);
});

test('a kernel station opened from a lecture keeps the seed, and a rerun keeps the way back', async ({ page }) => {
  await page.goto('/#lecture/1/9');
  await page.getByRole('link', { name: /Open the Urn station/ }).click();
  await expect(page).toHaveURL(/#station\/urn\?seed=101&.*lecture=1&step=9$/);
  await expect(page.getByTestId('station-dock').getByRole('link', { name: 'Back to lecture 1, step 9' })).toBeVisible();

  // A rerun with a new seed rewrites the hash and keeps the reference to the step.
  await page.goto('/#station/contract-fixture?seed=7&n=2000&lecture=2&step=1');
  const dock = page.getByTestId('station-dock');
  await dock.getByLabel('Random seed').fill('11');
  await expect(page).toHaveURL(/seed=11.*&lecture=2&step=1$/);
  await dock.getByRole('link', { name: 'Back to lecture 2, step 1' }).click();
  await expect(page).toHaveURL(/#lecture\/2\/1$/);
});

test('presenter mode enlarges type, reduces the scene chrome and keeps the counter and keys visible', async ({ page }) => {
  await page.goto('/#lecture/1/17');
  const idea = page.locator('.lecture-idea');
  const normal = await idea.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  await page.keyboard.press('p');
  await expect(page).toHaveURL(/#lecture\/1\/17\?present=1$/);
  await expect(page.locator('html')).toHaveAttribute('data-present', '');
  const large = await idea.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(large).toBeGreaterThanOrEqual(20);
  expect(large).toBeGreaterThan(normal);
  await expect(page.getByRole('navigation', { name: 'Lecture orbits' })).toBeHidden();
  await expect(page.getByRole('img', { name: /Earth point cloud/ })).toBeHidden();
  await expect(page.getByTestId('step-counter')).toBeVisible();
  await expect(page.locator('.lecture-keys')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Presenter' })).toHaveAttribute('aria-pressed', 'true');
  expect(await fits(page)).toBe(true);

  // Steps keep presenter mode, and so does a trip to a station and back.
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/#lecture\/1\/18\?present=1$/);
  await page.getByRole('link', { name: /Throw the three chord schemes/ }).click();
  await expect(page).toHaveURL(/lecture=1&step=18&present=1$/);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#lecture\/1\/18\?present=1$/);
  // The address changes a frame before the lecture dock mounts; wait for it before the next key.
  await expect(page.getByTestId('step-counter')).toHaveText(/Step 18 \//);

  await page.keyboard.press('p');
  await expect(page).toHaveURL(/#lecture\/1\/18$/);
  await expect(page.locator('html')).not.toHaveAttribute('data-present', '');
  await expect(page.getByRole('navigation', { name: 'Lecture orbits' })).toBeVisible();
});

test('a portrait file renders in the fixed slot; an empty or missing file shows a labelled placeholder', async ({ page }) => {
  const art = ' .---.\n( o o )\n |   |\n';
  await page.route('**/portraits/bayes.txt', (r) => r.fulfill({ status: 200, contentType: 'text/plain', body: art }));
  await page.goto('/#lecture/2/6');
  const bayes = page.locator('.portrait[data-slug="bayes"]');
  await expect(bayes.getByRole('img', { name: 'ASCII portrait of Thomas Bayes' })).toHaveText(art.trimEnd());
  await expect(bayes).toContainText('1701–1761');

  // The shipped slot files are empty: every one shows the placeholder with name, years and contribution.
  await page.goto('/#lecture/3/6');
  const moivre = page.locator('.portrait[data-slug="de-moivre"]');
  await expect(moivre).toHaveAttribute('data-state', 'placeholder');
  await expect(moivre).toContainText('Abraham de Moivre');
  await expect(moivre).toContainText('1667–1754');
  await expect(moivre).toContainText('Normal approximation to the binomial law.');
  const slot = await moivre.locator('.portrait-art').boundingBox();
  await page.goto('/#lecture/2/6');
  const filled = await page.locator('.portrait[data-slug="bayes"] .portrait-art').boundingBox();
  expect(Math.round(filled.width)).toBe(Math.round(slot.width));
  expect(Math.round(filled.height)).toBe(Math.round(slot.height));

  // A missing file (404, or the dev server's HTML fallback page) is a placeholder too.
  await page.unroute('**/portraits/bayes.txt');
  await page.route('**/portraits/bayes.txt', (r) => r.fulfill({ status: 404, body: 'Not found' }));
  await page.route('**/portraits/laplace.txt', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
  await page.goto('/?fresh=1#lecture/2/6'); // a full load: the portrait cache lives in the page
  await expect(page.locator('.portrait[data-slug="bayes"]')).toHaveAttribute('data-state', 'placeholder');
  await expect(page.locator('.portrait[data-slug="bayes"]')).toContainText('Thomas Bayes');
  await page.goto('/#lecture/3/7');
  await expect(page.locator('.portrait[data-slug="laplace"]')).toHaveAttribute('data-state', 'placeholder');
});

test('lectures load no network fonts or other external resources', async ({ page }) => {
  const external = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1') && !r.url().startsWith('data:')) external.push(r.url());
  });
  for (let n = 1; n <= 12; n++) {
    await page.goto(`/#lecture/${n}/1`);
    await expect(page.getByTestId('lecture-player')).toBeVisible();
    expect(await fits(page), `lecture ${n}`).toBe(true);
  }
  expect(external).toEqual([]);
});

test('#98: a portrait types itself in, and art larger than the slot is scaled down without wrapping', async ({ page }) => {
  const wide = Array.from({ length: 30 }, (_, i) => String(i % 10).repeat(70)).join('\n');
  await page.route('**/portraits/bayes.txt', (r) => r.fulfill({ status: 200, contentType: 'text/plain', body: wide }));
  await page.emulateMedia({ reducedMotion: 'no-preference' }); // the file's beforeEach reduces motion
  await page.goto('/#lecture/2/6');
  const art = page.locator('.portrait[data-slug="bayes"] pre.portrait-art');
  // It types in over a few frames, then settles on the art itself.
  await expect(art).toHaveAttribute('data-typing', 'true');
  await expect(art).not.toHaveAttribute('data-typing', 'true');
  await expect(art).toHaveText(wide);
  const fit = await art.evaluate((pre) => {
    const text = pre.querySelector('.portrait-text');
    const a = pre.getBoundingClientRect(), t = text.getBoundingClientRect();
    const lineHeight = parseFloat(getComputedStyle(text).lineHeight);
    return { inside: t.width <= a.width + 0.5 && t.height <= a.height + 0.5, lines: Math.round(t.height / lineHeight) };
  });
  expect(fit.inside).toBe(true);
  expect(fit.lines).toBe(30); // 30 source lines, 30 rendered lines: nothing wrapped

  // Reduced motion: the art is there at once.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?again=1#lecture/2/6');
  await expect(page.locator('.portrait[data-slug="bayes"] pre.portrait-art')).toHaveText(wide);
  await expect(page.locator('.portrait[data-slug="bayes"] pre.portrait-art')).not.toHaveAttribute('data-typing', 'true');
});
