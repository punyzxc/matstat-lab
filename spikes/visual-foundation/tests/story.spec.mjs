import { expect, test } from '@playwright/test';

// #109 live formulas, #110 story lectures, #111 the normal factory (L8), #112 the confidence interval wall (L11),
// #135 clouds of estimates and the n vs n - 1 race (L11), #138 math portals.
const fits = (page) => page.evaluate(() => document.scrollingElement.scrollHeight <= window.innerHeight);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 860 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('L8 reads as a story: text beside a live figure, and the hash follows the step being read', async ({ page }) => {
  await page.goto('/#lecture/8/1');
  const player = page.getByTestId('lecture-player');
  await expect(page.getByTestId('lecture-dock')).toHaveClass(/scene-dock--story/);
  await expect(player.locator('canvas.figure-canvas')).toBeVisible();
  await expect(page.getByTestId('step-counter')).toHaveText('Step 1 / 8');
  await expect(page.getByTestId('story-beat')).toHaveText('One term');
  expect(await fits(page)).toBe(true);

  await page.keyboard.press('ArrowDown');
  await expect(page).toHaveURL(/#lecture\/8\/2$/);
  await expect(page.getByTestId('story-beat')).toContainText('independent terms');
  await page.keyboard.press('End');
  await expect(page).toHaveURL(/#lecture\/8\/8$/);
  await page.keyboard.press('Home');
  await expect(page).toHaveURL(/#lecture\/8\/1$/);

  // scrolling the text moves the story too
  await page.getByTestId('story-text').evaluate((el) => {
    const s = el.querySelector('[data-step="5"]');
    el.scrollTop = s.offsetTop - 20;
  });
  await expect(page).toHaveURL(/#lecture\/8\/5$/);
  await expect(page.getByTestId('story-beat')).toHaveText('Thousands of sums');

  // a deep link opens at its step
  await page.goto('/#lecture/8/6');
  await expect(page.getByTestId('step-counter')).toHaveText('Step 6 / 8');
  await expect(page.getByTestId('story-beat')).toHaveText('The normal law appears');
});

test('live formula: a hovered symbol lights up the figure and explains itself; a value typed inside the formula drives the experiment', async ({ page }) => {
  await page.goto('/#lecture/8/4');
  const step = page.locator('[data-step="4"]');
  const formula = step.getByTestId('live-formula');
  // the symbol S_n in the formula and the machine label share the highlight
  await formula.locator('[data-v="S"]').first().hover();
  await expect(formula.getByRole('tooltip')).toContainText('The sum of the n terms');
  await expect(page.locator('.figure-label.is-hot').first()).toBeVisible();

  const value = formula.locator('[data-v="n"][data-role="edit"]').first();
  await expect(value).toHaveText('8');
  await value.focus();
  await page.keyboard.press('Enter');
  const input = formula.getByRole('textbox');
  await input.fill('40');
  await input.press('Enter');
  await expect(formula.locator('[data-v="n"][data-role="edit"]').first()).toHaveText('40');
  await expect(page.getByTestId('story-open-station')).toHaveAttribute('href', /#station\/clt\?seed=808&law=1&n=40&R=4000&view=0&lecture=8&step=4$/);

  // out of range is clamped; arrow keys step by one
  await formula.locator('[data-v="n"][data-role="edit"]').first().focus();
  await page.keyboard.type('9');
  await page.keyboard.type('99');
  await page.keyboard.press('Enter');
  await expect(formula.locator('[data-v="n"][data-role="edit"]').first()).toHaveText('100');
  await formula.locator('[data-v="n"][data-role="edit"]').first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(formula.locator('[data-v="n"][data-role="edit"]').first()).toHaveText('99');
  // arrows inside a formula value do not turn the page
  await expect(page).toHaveURL(/#lecture\/8\/4$/);
});

test('"what if" chips rebuild the experiment; layers open on demand; Demo resets per step, Explore keeps values', async ({ page }) => {
  await page.goto('/#lecture/8/5');
  const step = page.locator('[data-step="5"]');
  const chip = step.getByRole('button', { name: /What if… n = 30$/ });
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('story-open-station')).toHaveAttribute('href', /n=30&/);
  await step.getByText('Intuition').click();
  await expect(step.locator('details.story-layer--intuition')).toHaveAttribute('open', '');
  await expect(step.locator('details.story-layer--intuition p')).toContainText('the exponential law itself');

  // Demo: the next step starts from its own preset (n = 12)
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('story-open-station')).toHaveAttribute('href', /n=12&/);
  // Explore: every parameter is typeable and survives a step change
  await page.keyboard.press('e');
  const panel = page.getByTestId('story-explore');
  await expect(panel).toBeVisible();
  const n = panel.getByRole('textbox', { name: /Terms in the sum/ });
  await n.fill('64');
  await n.press('Enter');
  await expect(page.getByTestId('story-open-station')).toHaveAttribute('href', /n=64&/);
  await n.evaluate((el) => el.blur()); // keys typed into a field never turn the page
  await page.keyboard.press('ArrowUp');
  await expect(page).toHaveURL(/#lecture\/8\/5$/);
  await expect(page.getByTestId('story-open-station')).toHaveAttribute('href', /n=64&/);
});

test('the figure expands into its full station, and Esc folds back to the same step', async ({ page }) => {
  await page.goto('/#lecture/8/6');
  await page.getByTestId('story-open-station').click();
  await expect(page).toHaveURL(/#station\/clt\?seed=808&law=1&n=12&R=4000&view=0&lecture=8&step=6$/);
  await expect(page.getByTestId('station-dock')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#lecture\/8\/6$/);
  await expect(page.getByTestId('step-counter')).toHaveText('Step 6 / 8');
  // A Bernoulli source has no full station: the button says so instead of linking
  await page.locator('[data-step="6"]').getByRole('button', { name: /rare coin/ }).click();
  await expect(page.getByTestId('story-open-station')).toHaveCount(0);
});

test('L11 interval wall: 1000 intervals cover as often as the Confidence station says; γ typed in the formula re-runs it', async ({ page }) => {
  await page.goto('/#lecture/11/5');
  await expect(page.getByTestId('story-beat')).toHaveText('A thousand intervals');
  // reduced motion fills the wall at once: 940 of 1000 Student intervals cover a (seed 1111, n = 10, γ = 0.95)
  await expect(page.getByTestId('ci-coverage')).toHaveText('94.0%');
  const formula = page.locator('[data-step="5"]').getByTestId('live-formula').first();
  await expect(formula.locator('[data-v="hits"]')).toHaveText('940');
  const gamma = formula.locator('[data-v="gamma"][data-role="edit"]');
  await gamma.click();
  await formula.getByRole('textbox').fill('0.8');
  await formula.getByRole('textbox').press('Enter');
  await expect(gamma).toHaveText('0.80');
  await expect(page.getByTestId('ci-coverage')).not.toHaveText('94.0%');
  await expect(page.getByTestId('story-open-station')).toHaveAttribute('href', /#station\/confidence\?seed=1111&n=10&gamma=0.8&law=0&target=0&R=1000&view=1&lecture=11&step=5$/);
  expect(await fits(page)).toBe(true);
});

test('L11 estimate cloud: typing n tightens the cloud; the n vs n - 1 race shows the bias and expands into the Estimation station', async ({ page }) => {
  await page.goto('/#lecture/11/2');
  await expect(page.getByTestId('story-beat')).toHaveText('A cloud of sample means');
  const cloud = page.locator('[data-step="2"]').getByTestId('live-formula').first();
  // reduced motion fills the cloud at once: 2000 sample means of n = 5
  await expect(cloud.locator('[data-v="sdth"][data-role="res"]')).toHaveText('0.447');
  const wide = Number(await cloud.locator('[data-v="sdx"][data-role="res"]').textContent());
  expect(Math.abs(wide - 0.447)).toBeLessThan(0.03);
  const n = cloud.locator('[data-v="n"][data-role="edit"]');
  await n.click();
  await cloud.getByRole('textbox').fill('50');
  await cloud.getByRole('textbox').press('Enter');
  await expect(cloud.locator('[data-v="sdth"][data-role="res"]')).toHaveText('0.141');
  await expect.poll(async () => Number(await cloud.locator('[data-v="sdx"][data-role="res"]').textContent())).toBeLessThan(wide / 2.5);

  await page.goto('/#lecture/11/3');
  await expect(page.getByTestId('story-beat')).toContainText('Divisor');
  const race = page.locator('[data-step="3"]').getByTestId('live-formula').nth(2);
  // seed 1111, n = 5, 2000 samples: the Estimation station's bias readouts (-0.2144 and -0.0180)
  await expect(race.locator('[data-v="mn"][data-role="res"]')).toHaveText('0.786');
  await expect(race.locator('[data-v="mn1"][data-role="res"]')).toHaveText('0.982');
  await expect(race.locator('[data-v="mnth"][data-role="res"]')).toHaveText('0.8');
  await expect(page.getByTestId('story-open-station')).toHaveAttribute('href', /#station\/estimation\?seed=1111&n=5&sigma=1&law=0&R=2000&view=0&lecture=11&step=3$/);
  expect(await fits(page)).toBe(true);
});

test('a math portal previews another lecture live over the figure; Esc comes back, "Go there" opens it', async ({ page }) => {
  await page.goto('/#lecture/11/4');
  const link = page.locator('[data-step="4"]').getByTestId('story-portal');
  await expect(link).toHaveAccessibleName(/Portal: Lecture 8, The central limit theorem/);
  await link.click();
  const portal = page.getByTestId('story-portal-view');
  await expect(portal).toBeVisible();
  await expect(portal.locator('#story-portal-title')).toHaveText('The central limit theorem');
  // the preview is live: its own figure and its live formula with the Kolmogorov distance
  await expect(portal.locator('canvas')).toBeVisible();
  await expect(portal.getByTestId('live-formula').locator('[data-v="ks"][data-role="res"]')).not.toHaveText('—');
  await expect(page.getByRole('button', { name: /^Back/ })).toBeFocused();
  // arrows do not move the lecture behind the portal
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(portal).toHaveCount(0);
  await expect(page).toHaveURL(/#lecture\/11\/4$/);
  await expect(page.getByTestId('step-counter')).toHaveText('Step 4 / 7');
  await expect(link).toBeFocused();

  await link.click();
  await page.getByTestId('story-portal-go').click();
  await expect(page).toHaveURL(/#lecture\/8\/6$/);
  await expect(page.getByTestId('story-beat')).toHaveText('The normal law appears');
  await expect(page.getByTestId('step-counter')).toHaveText('Step 6 / 8');
  await expect(page.locator('[data-step="6"]').getByTestId('story-portal')).toHaveAccessibleName(/Lecture 11, A wall of intervals/);
  expect(await fits(page)).toBe(true);
});

test('old step-by-step lectures keep their player', async ({ page }) => {
  await page.goto('/#lecture/3/1');
  await expect(page.getByTestId('lecture-dock')).not.toHaveClass(/scene-dock--story/);
  await expect(page.getByTestId('step-counter')).toHaveText('Step 1 / 4');
});
