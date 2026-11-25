import { expect, test } from '@playwright/test';
import { parseRoute, stationHash } from '../src/stations/route.ts';
import { resolveParams } from '../src/stations/kernel-contract.ts';
import { ticks } from '../src/stations/chart.tsx';

test('route parsing never throws and only accepts what the UI accepts', () => {
  expect(parseRoute('#station/urn?seed=%E0').seed).toBe(null);
  expect(parseRoute('#station/urn?%=1').params).toEqual({});
  for (const bad of ['', '%20', '0x10', '1e3', '-1', '4294967296', '1.5'])
    expect(parseRoute(`#station/urn?seed=${bad}`).seed, bad).toBe(null);
  expect(parseRoute('#station/urn?seed=0').seed).toBe(0);
  expect(parseRoute('#station/urn?seed=4294967295').seed).toBe(4294967295);
  expect(parseRoute('#station/urn?n=').params).toEqual({});
  expect(parseRoute('#station/urn?n=abc&p=0.25&q=-3e-2').params).toEqual({ p: 0.25, q: -0.03 });
  expect(parseRoute('#station/urn?seed=1?n=2')).toMatchObject({ seed: 1, params: { n: 2 } });
  expect(parseRoute('#workspace?seed=3')).toMatchObject({ station: 'distribution', seed: 3 });
  expect(parseRoute('#station/nope').station).toBe(null);
  const hash = stationHash('bayes', 9, { 'a b': 1, 'x&y': 2 });
  expect(parseRoute(hash)).toMatchObject({ station: 'bayes', seed: 9, params: { 'a b': 1, 'x&y': 2 } });
});

test('parameters clamp to their range, snap to the grid and keep both ends reachable', () => {
  const p = (o) => ({ key: 'v', label: 'v', min: 0, max: 1, step: 0.3, default: 0.5, ...o });
  expect(resolveParams([p()], {})).toEqual({ v: 0.5 });
  expect(resolveParams([p()], { v: 1 })).toEqual({ v: 1 });
  expect(resolveParams([p()], { v: 7 })).toEqual({ v: 1 });
  expect(resolveParams([p()], { v: 0.31 })).toEqual({ v: 0.3 });
  expect(resolveParams([p({ step: 0 })], { v: 0.42 })).toEqual({ v: 0.42 });
  expect(resolveParams([p({ min: 10, max: 0, step: 1 })], { v: 4.4 })).toEqual({ v: 4 });
  expect(resolveParams([p({ step: 0.1 })], { v: 0.7000001 })).toEqual({ v: 0.7 });
});

test('chart ticks are round numbers covering the range', () => {
  expect(ticks(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  expect(ticks(-4, 4, 6)).toEqual([-4, -2, 0, 2, 4]);
  expect(ticks(220, 300, 6)).toEqual([220, 240, 260, 280, 300]);
});

test('a contract kernel renders as a station and its URL reproduces the run', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/contract-fixture?seed=7&n=2000&p=0.3');
  const dock = page.getByTestId('station-dock');
  await expect(dock.getByLabel('Trials n', { exact: true })).toHaveValue('2000');
  await expect(dock.getByLabel('Random seed')).toHaveValue('7');
  await expect(dock.getByRole('img', { name: /m\/k/ })).toBeVisible();
  const readout = dock.getByRole('row', { name: /Relative frequency/ });
  const first = await readout.textContent();
  // No Run button: a reduced-motion visitor gets a stopped experiment that still reacts at once.
  await expect(dock.getByRole('button', { name: /Run With|Up to Date/ })).toHaveCount(0);
  await expect(dock.getByRole('button', { name: 'Play the experiment' })).toBeVisible();

  await dock.getByLabel('Random seed').fill('11');
  await expect(page).toHaveURL(/seed=11/);
  await expect(readout).not.toHaveText(first);

  const fresh = await context.newPage();
  // Same reduced-motion visitor, so autoplay does not grow the sample before the readout is compared.
  await fresh.emulateMedia({ reducedMotion: 'reduce' });
  await fresh.goto('/#station/contract-fixture?seed=7&n=2000&p=0.3');
  await expect(fresh.getByTestId('station-dock').getByRole('row', { name: /Relative frequency/ })).toHaveText(first);
  // the fixture never appears on an orbit
  await fresh.goto('/#orbit/probability');
  await expect(fresh.locator('.orbit-node')).toHaveCount(6); // the six visible stations of orbit I, without the fixture
});

test('a broken link or a failing station never blanks the program', async ({ page }) => {
  await page.goto('/#station/urn?seed=%E0');
  await expect(page.getByRole('navigation', { name: 'Lecture orbits' })).toBeVisible();
  await expect(page.getByTestId('station-dock')).toBeVisible();
});

test('legacy stations honour a seed in the URL', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/distribution?seed=7');
  await expect(page.getByLabel('Random seed')).toHaveValue('7');
  await page.goto('/#station/convergence?seed=9');
  await expect(page.locator('.method-desk .session-source')).toContainText('seed 9');
});

test('a kernel station plays by itself: it grows the sample, keeps drawing, stops on Space and steps on N', async ({ page }) => {
  await page.goto('/#station/contract-fixture?seed=7&n=2000&p=0.3');
  const dock = page.getByTestId('station-dock');
  const status = dock.locator('.autoplay-status');
  await expect(status).toContainText('Growing the sample');
  await expect(status).toContainText(/Live · draw [2-9]/, { timeout: 15000 });
  await dock.getByRole('heading', { name: 'Contract fixture' }).focus();
  await page.keyboard.press('Space');
  await expect(dock.getByRole('button', { name: 'Play the experiment' })).toBeVisible();
  const stopped = (await status.textContent()).match(/seed (\d+)/)[1];
  await page.waitForTimeout(1500);
  await expect(status).toContainText(`seed ${stopped}`);
  await expect(page).toHaveURL(new RegExp(`seed=${stopped}`));
  await page.keyboard.press('n');
  await expect(status).toContainText(`seed ${Number(stopped) + 1}`);
  // Each draw adds a dot to the across-draws trace of the followed readout.
  await expect(dock.getByRole('region', { name: /across draws/ })).toContainText(/over \d+ draws/);
});

test('typed parameter values accept arithmetic and decimal commas, and clamp to the range', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/contract-fixture?seed=7&n=2000&p=0.3');
  const dock = page.getByTestId('station-dock');
  const p = dock.getByLabel('Probability p, typed value');
  await p.fill('1/4');
  await p.press('Enter');
  await expect(dock.getByLabel('Probability p', { exact: true })).toHaveValue('0.25');
  await expect(page).toHaveURL(/p=0\.25/);
  await p.fill('0,6');
  await p.press('Enter');
  await expect(page).toHaveURL(/p=0\.6/);
  const n = dock.getByLabel('Trials n, typed value');
  await n.fill('1e9');
  await n.press('Enter');
  await expect(dock.getByText(/Kept within 100 … 5/)).toBeVisible();
  await expect(page).toHaveURL(/n=5000/);
  await n.press('ArrowDown');
  await expect(page).toHaveURL(/n=4900/);
});

test('a parameter with named values is a row of choices', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/lln?seed=3');
  const dock = page.getByTestId('station-dock');
  const law = dock.getByRole('radiogroup', { name: 'Law' });
  await expect(law.getByRole('radio', { name: 'Cauchy' })).toHaveAttribute('aria-checked', 'true');
  await law.getByRole('radio', { name: 'normal' }).click();
  await expect(page).toHaveURL(/law=0/);
  await page.keyboard.press('ArrowRight');
  await expect(law.getByRole('radio', { name: 'uniform' })).toBeFocused();
  await expect(page).toHaveURL(/law=1/);
});
