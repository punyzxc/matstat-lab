import { expect, test } from '@playwright/test';

// #109 live formulas, #110 story lectures, #111 the normal factory (L8), #112 the confidence interval wall (L11),
// #135 clouds of estimates and the n vs n - 1 race (L11), #138 math portals, #134 scientist cards, L12 the hypothesis court, #125 the living population (L10), the corridor of running means (L7), the centre of mass (L6), darts on a board (L4).
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

test('scientist cards sit in the figure while their step is read, open in place and fade on the next step', async ({ page }) => {
  await page.goto('/#lecture/8/6');
  const cards = page.getByTestId('scientist-cards');
  await expect(cards.locator('.scientist-card')).toHaveCount(2);
  const lindeberg = cards.locator('.scientist-card[data-slug="lindeberg"]');
  await expect(lindeberg).toContainText('Jarl Waldemar Lindeberg');
  await expect(lindeberg).toContainText('1876–1932');
  await expect(lindeberg.locator('.portrait')).toBeVisible();
  const more = lindeberg.locator('.scientist-card-toggle');
  await expect(more).toHaveText(/More/);
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(lindeberg).toContainText('In 1922 he proved');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('step-counter')).toHaveText('Step 7 / 8');
  await expect(cards).toHaveCount(0);
  expect(await fits(page)).toBe(true);
});

test('L12 hypothesis court: a thousand verdicts reject as often as the Testing station; with H0 true the rate falls to alpha', async ({ page }) => {
  await page.goto('/#lecture/12/2');
  await expect(page.getByTestId('story-beat')).toHaveText('Two laws of one statistic');
  const region = page.locator('[data-step="2"]').getByTestId('live-formula').first();
  await expect(region.locator('[data-v="ucr"][data-role="res"]')).toHaveText('1.645');

  await page.goto('/#lecture/12/4');
  await expect(page.getByTestId('story-beat')).toHaveText('A thousand verdicts');
  // reduced motion judges all 1000 samples at once: 660 of them reject H0 (seed 1212, n = 16, a = 0.5, alpha = 0.05)
  await expect(page.getByTestId('court-rate')).toHaveText('66.0%');
  const verdicts = page.locator('[data-step="4"]').getByTestId('live-formula').first();
  await expect(verdicts.locator('[data-v="power"][data-role="res"]')).toHaveText('0.639');
  await expect(verdicts.locator('[data-v="count"][data-role="res"]')).toHaveText('1000');
  await expect(page.getByTestId('story-open-station')).toHaveAttribute('href', /#station\/testing\?seed=1212&sigmaKnown=1&a0=0&mu=0.5&sigma=1&n=16&alpha=0.05&tail=1&R=1000&view=0&truth=1&lecture=12&step=4$/);
  expect(await fits(page)).toBe(true);

  await page.goto('/#lecture/12/5');
  await expect(page.getByTestId('court-rate')).toHaveText('5.6%');
  const alpha = page.locator('[data-step="5"]').getByTestId('live-formula').first().locator('[data-v="alpha"][data-role="edit"]');
  await alpha.click();
  await page.locator('[data-step="5"]').getByRole('textbox').fill('0.01');
  await page.locator('[data-step="5"]').getByRole('textbox').press('Enter');
  await expect(alpha).toHaveText('0.010');
  await expect(page.getByTestId('court-rate')).not.toHaveText('5.6%');
  await expect.poll(async () => parseFloat(await page.getByTestId('court-rate').textContent())).toBeLessThan(3);

  await page.goto('/#lecture/12/6');
  await expect(page.getByTestId('story-beat')).toHaveText('The power curve');
  await expect(page.locator('[data-step="6"]').getByTestId('live-formula').first().locator('[data-v="power"][data-role="res"]')).toHaveText('0.639');
  expect(await fits(page)).toBe(true);
});

test('L10 living population: the sample becomes a table that sums to n, and a hovered observation lights up in all four portraits', async ({ page }) => {
  await page.goto('/#lecture/10/1');
  await expect(page.getByTestId('story-beat')).toHaveText('A sample leaves the population');
  await expect(page.locator('[data-step="1"]').getByTestId('live-formula').first().locator('[data-v="xbar"][data-role="res"]')).toHaveText('1.125');

  await page.goto('/#lecture/10/3');
  await expect(page.getByTestId('story-beat')).toHaveText('The frequency table');
  const step = page.locator('[data-step="3"]');
  await expect(step.getByTestId('live-formula').nth(0).locator('[data-v="k"][data-role="res"]')).toHaveText('10');
  await expect(step.getByTestId('live-formula').nth(2).locator('[data-v="sum"][data-role="res"]')).toHaveText('100');
  const n = step.getByTestId('live-formula').first().locator('[data-v="n"][data-role="edit"]');
  await n.click();
  await step.getByRole('textbox').fill('1000');
  await step.getByRole('textbox').press('Enter');
  await expect(step.getByTestId('live-formula').nth(0).locator('[data-v="k"][data-role="res"]')).toHaveText('15');
  await expect(step.getByTestId('live-formula').nth(2).locator('[data-v="sum"][data-role="res"]')).toHaveText('1000');
  await expect(page.getByTestId('story-open-station')).toHaveAttribute('href', /#station\/sample\?seed=1010&law=0&n=1000&bins=0&digits=0&view=0&lecture=10&step=3$/);
  expect(await fits(page)).toBe(true);

  await page.goto('/#lecture/10/6');
  await expect(page.getByTestId('story-beat')).toHaveText('One sample, four portraits');
  const figure = page.locator('.figure--sample');
  const box = await figure.boundingBox();
  let found = false;
  for (let dy = -40; dy <= 40 && !found; dy += 4)
    for (let dx = 0; dx <= 160 && !found; dx += 3) {
      await page.mouse.move(box.x + box.width * 0.2 + dx, box.y + box.height * 0.8 + dy);
      found = (await page.getByTestId('sample-obs').count()) > 0;
    }
  expect(found).toBe(true);
  await expect(page.getByTestId('sample-obs')).toContainText('F');
  await page.mouse.move(box.x + 5, box.y + box.height - 5);
  await expect(page.getByTestId('sample-obs')).toHaveCount(0);

  await page.goto('/#lecture/10/7');
  await expect(page.locator('[data-step="7"]').getByTestId('live-formula').first().locator('[data-v="dn"][data-role="res"]')).toHaveText('0.101');
  expect(await fits(page)).toBe(true);
});

test('L7 corridor: Chebyshev against the real tails, then 200 running means whose share outside the corridor falls under the bound', async ({ page }) => {
  await page.goto('/#lecture/7/1');
  await expect(page.getByTestId('story-beat')).toHaveText('Chebyshev against the real tails');
  const tail = page.locator('[data-step="1"]').getByTestId('live-formula');
  // reduced motion draws all 20000 at once: 960 of them lie 2 sigma or more from the mean (seed 707), as on the LLN station
  await expect(tail.nth(0).locator('[data-v="tailsim"][data-role="res"]')).toHaveText('0.048');
  await expect(tail.nth(1).locator('[data-v="kbound"][data-role="res"]')).toHaveText('0.25');
  const k = tail.nth(0).locator('[data-v="k"][data-role="edit"]');
  await k.click();
  await page.locator('[data-step="1"]').getByRole('textbox').fill('3');
  await page.locator('[data-step="1"]').getByRole('textbox').press('Enter');
  await expect(tail.nth(1).locator('[data-v="kbound"][data-role="res"]')).toHaveText('0.1111');
  await expect(page.getByTestId('story-open-station')).toHaveAttribute('href', /#station\/lln\?seed=707&law=0&N=2000&k=3&view=1&lecture=7&step=1$/);
  expect(await fits(page)).toBe(true);

  await page.goto('/#lecture/7/3');
  await expect(page.getByTestId('story-beat')).toHaveText('Running means in a corridor');
  const corridor = page.locator('[data-step="3"]').getByTestId('live-formula');
  await expect(corridor.nth(0).locator('[data-v="bound"][data-role="res"]')).toHaveText('0.013');
  await expect(page.getByTestId('lln-count')).toContainText('0 of 200');
  const eps = corridor.nth(0).locator('[data-v="eps"][data-role="edit"]');
  await eps.click();
  await page.locator('[data-step="3"]').getByRole('textbox').fill('0.02');
  await page.locator('[data-step="3"]').getByRole('textbox').press('Enter');
  await expect(page.getByTestId('lln-count')).not.toContainText(' 0 of 200');
  await expect(page.getByTestId('story-open-station')).toHaveAttribute('href', /#station\/lln\?seed=707&law=2&N=2000&view=2&M=200&eps=0.02&lecture=7&step=3$/);
  expect(await fits(page)).toBe(true);

  await page.goto('/#lecture/7/5');
  await expect(page.getByTestId('lln-count')).toContainText('no Chebyshev bound');
});

test('L6 centre of mass: the beam balances at the mean, the sigma bands hold the 3 sigma rule, the box slides', async ({ page }) => {
  await page.goto('/#lecture/6/1');
  await expect(page.getByTestId('story-beat')).toHaveText('The beam balances at the mean');
  const beam = page.locator('[data-step="1"]').getByTestId('live-formula');
  await expect(beam.nth(0).locator('[data-v="Mx"][data-role="res"]')).toHaveText('0.1');
  // reduced motion throws all 2000 at once: their mean is the Balance station's 0.066 (seed 606)
  await expect(beam.nth(1).locator('[data-v="xbar"][data-role="res"]')).toHaveText('0.066');
  await beam.nth(0).locator('[data-v="x4"][data-role="edit"]').click();
  await page.locator('[data-step="1"]').getByRole('textbox').fill('5');
  await page.locator('[data-step="1"]').getByRole('textbox').press('Enter');
  await expect(beam.nth(0).locator('[data-v="Mx"][data-role="res"]')).toHaveText('0.2');
  await expect(page.getByTestId('story-open-station')).toHaveAttribute('href', /#station\/balance\?seed=606&.*x4=5.*&lecture=6&step=1$/);
  expect(await fits(page)).toBe(true);

  await page.goto('/#lecture/6/3');
  await expect(page.getByTestId('story-beat')).toHaveText('Bands of one, two and three sigma');
  await expect(page.getByTestId('sigma-in3')).toHaveText('0.9970');
  await expect(page.getByTestId('sigma-table')).toContainText('0.9973');
  await expect(page.getByTestId('story-open-station')).toHaveAttribute('href', /#station\/moments\?seed=606&law=5&.*&lecture=6&step=3$/);
  expect(await fits(page)).toBe(true);

  await page.goto('/#lecture/6/4');
  await expect(page.getByTestId('story-beat')).toHaveText('The box slides along the density');
  // reduced motion parks the box at z = m/2, the top of the triangle
  const slide = page.locator('[data-step="4"]').getByTestId('live-formula');
  await expect(slide.nth(1).locator('[data-v="fz"][data-role="res"]')).toHaveText('1');
  await expect(page.getByTestId('story-open-station')).toHaveAttribute('href', /#station\/convolution\?seed=606&m=2&R=5000&lecture=6&step=4$/);
  expect(await fits(page)).toBe(true);
});

test('L4 darts: disjoint strips add up, overlapping ones count the overlap twice; area, needle and chords match the Darts station', async ({ page }) => {
  await page.goto('/#lecture/4/1');
  await expect(page.getByTestId('story-beat')).toHaveText('Events are regions of the square');
  const ax = page.locator('[data-step="1"]').getByTestId('live-formula');
  // reduced motion throws all 4000 darts at once (seed 404): the bars agree while A and B are disjoint
  await expect(ax.nth(2).locator('[data-v="pU"][data-role="res"]')).toHaveText('0.7');
  await expect(ax.nth(2).locator('[data-v="sumAB"][data-role="res"]')).toHaveText('0.7');
  await expect(page.getByTestId('story-open-station')).toHaveAttribute('href', /#station\/darts\?seed=404&view=4&N=4000&region=x%20%3C%200\.3%20or%20x%20%3E%200\.6&lecture=4&step=1$/);
  await ax.nth(1).locator('[data-v="b"][data-role="edit"]').click();
  await page.locator('[data-step="1"]').getByRole('textbox').fill('0.85');
  await page.locator('[data-step="1"]').getByRole('textbox').press('Enter');
  await expect(ax.nth(2).locator('[data-v="sumAB"][data-role="res"]')).not.toHaveText('0.7');
  await expect(page.getByTestId('story-open-station')).toHaveAttribute('href', /region=x%20%3C%200\.3%20or%20x%20%3E%200\.15&/);
  expect(await fits(page)).toBe(true);

  await page.goto('/#lecture/4/3');
  await expect(page.getByTestId('story-beat')).toHaveText('Probability is area');
  await expect(page.locator('[data-step="3"]').getByTestId('live-formula').nth(1).locator('[data-v="pihat"][data-role="res"]')).toHaveText('3.125');
  await page.goto('/#lecture/4/4');
  await expect(page.getByTestId('story-beat')).toHaveText("Buffon's needle");
  await expect(page.locator('[data-step="4"]').getByTestId('live-formula').nth(1).locator('[data-v="pihat"][data-role="res"]')).toHaveText('3.2112');
  await expect(page.getByTestId('story-open-station')).toHaveAttribute('href', /#station\/darts\?seed=404&view=3&N=4000&l=0\.8&d=1&lecture=4&step=4$/);
  await page.goto('/#lecture/4/5');
  await expect(page.getByTestId('story-beat')).toHaveText("Bertrand's three chords");
  await expect(page.locator('[data-step="5"]').getByTestId('live-formula').nth(0).locator('[data-v="radius"][data-role="res"]')).toHaveText('0.501');
  expect(await fits(page)).toBe(true);
});

test('old step-by-step lectures keep their player', async ({ page }) => {
  await page.goto('/#lecture/3/1');
  await expect(page.getByTestId('lecture-dock')).not.toHaveClass(/scene-dock--story/);
  await expect(page.getByTestId('step-counter')).toHaveText('Step 1 / 4');
});
