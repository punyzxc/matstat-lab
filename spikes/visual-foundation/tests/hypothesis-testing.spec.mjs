import { expect, test } from '@playwright/test';

// #97: Hypothesis Testing is a kernel station with typed H0/H1, alpha and n, a live power curve and a 3D power surface.
test('the testing station tests repeated samples live and shows both laws, the critical region and the rule', async ({ page }) => {
  await page.goto('/#station/testing?seed=11&a0=2&mu=2.5&sigma=1.5&n=16');
  const dock = page.getByTestId('station-dock');
  await expect(dock.getByRole('heading', { name: 'Hypothesis Testing' })).toBeVisible();
  // No Run button: it plays by itself and keeps drawing new experiments.
  await expect(dock.getByRole('button', { name: /^Run/ })).toHaveCount(0);
  await expect(dock.locator('.autoplay-status')).toContainText(/Live · draw [2-9]/, { timeout: 20000 });
  const readouts = dock.getByRole('table', { name: 'Readouts' });
  await expect(readouts.getByRole('row', { name: /Type I error/ })).toBeVisible();
  await expect(readouts.getByRole('row', { name: /Power/ }).first()).toBeVisible();
  // The rule is typeset (KaTeX), never plain text.
  const rule = readouts.getByRole('row', { name: /Decision rule/ });
  await expect(rule.locator('.katex').first()).toBeVisible();
  await expect(rule).toContainText(/reject/);
  // Both sampling laws, the critical region (alpha) and beta are drawn.
  const legend = dock.locator('.chart-stage');
  await expect(legend).toContainText(/H_0|Student/);
  await expect(legend).toContainText(/critical region/);
  await expect(legend).toContainText(/noncentral/);
  // The 3D power surface over (a, n).
  await expect(dock.getByText(/Power surface/).first()).toBeVisible();
  // The share of rejections is followed across draws.
  await expect(dock.getByRole('region', { name: /across draws/ })).toContainText(/over \d+ draws/, { timeout: 20000 });
});

test('typing n redraws the power curve, and the same seed gives the same surface', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/testing?seed=5&view=1&n=8');
  const dock = page.getByTestId('station-dock');
  const power = dock.getByRole('table', { name: 'Readouts' }).getByRole('row', { name: /at the true value/ });
  await expect(power).toBeVisible();
  const before = await power.textContent();
  const n = dock.getByLabel(/Sample size n, typed value/);
  await n.fill('64');
  await n.press('Enter');
  await expect(page).toHaveURL(/n=64/);
  await expect(power).not.toHaveText(before);
  const surface = await dock.locator('.surface-svg').first().getAttribute('aria-label');
  const again = await page.context().newPage();
  await again.emulateMedia({ reducedMotion: 'reduce' });
  await again.goto(page.url());
  await expect(again.getByTestId('station-dock').getByRole('table', { name: 'Readouts' }).getByRole('row', { name: /at the true value/ })).toHaveText(await power.textContent());
  expect(await again.getByTestId('station-dock').locator('.surface-svg').first().getAttribute('aria-label')).toBe(surface);
});

// #136: typed alpha slides the critical region; alpha, beta and the power are shaded and in a live formula.
test('the error lab: alpha, beta and the power are shaded and given in a live formula that follows typed values', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/testing?seed=4&sigmaKnown=1&a0=0&mu=0.5&sigma=1&n=16&tail=1');
  const dock = page.getByTestId('station-dock');
  const formula = dock.getByRole('group', { name: 'Live formula' });
  await expect(formula.locator('.katex').first()).toBeVisible();
  await expect(formula).toContainText('1.645');
  const keys = dock.locator('.chart-stage figcaption');
  await expect(keys).toContainText(/critical region/);
  await expect(keys).toContainText(/statistic in the critical region/);
  await expect(keys).toContainText(/acceptance region/);
  const alpha = dock.getByLabel(/Significance level α, typed value/);
  await alpha.fill('0,1');
  await alpha.press('Enter');
  await expect(page).toHaveURL(/alpha=0\.1/);
  await expect(formula).toContainText('1.282');
});

// #137: each experiment flies into one of four zones; the shares sit beside alpha, beta and the power.
test('the stream of decisions fills four zones and counts each row against alpha, beta and the power', async ({ page }) => {
  await page.goto('/#station/testing?seed=9&sigmaKnown=1&a0=0&mu=0.6&n=16&tail=1&R=400&truth=1');
  const dock = page.getByTestId('station-dock');
  const zones = dock.getByRole('region', { name: 'Decision zones' });
  await expect(zones).toBeVisible({ timeout: 15000 });
  const shares = zones.getByRole('table', { name: 'Zone shares' });
  const power = shares.locator('tr[data-cell="h1-reject"]');
  await expect.poll(async () => Number(await power.locator('td').first().textContent()), { timeout: 20000 }).toBeGreaterThan(40);
  await expect(power).toContainText(/1−β=0\.\d{3}/);
  await expect(zones.locator('circle.dz-dot').first()).toBeAttached();
  // Switching the truth sends H0 experiments: the H0 row starts to fill.
  await dock.getByRole('radiogroup', { name: /decision zones/ }).getByRole('radio').first().click();
  const typeI = shares.locator('tr[data-cell="h0-keep"]');
  await expect.poll(async () => Number(await typeI.locator('td').first().textContent()), { timeout: 20000 }).toBeGreaterThan(0);
  await expect(shares.locator('tr[data-cell="h0-reject"]')).toContainText(/α=0\.050/);
});
