import { expect, test } from '@playwright/test';

// #113: the time machine. Draw d of an experiment is replayed from its seed, so going back shows exactly what a fresh
// run at that seed shows, and the record costs no memory however long the experiment ran.
const URL = '/#station/fit?seed=7&view=0&law=0&h0=0&n=200&reps=0';

async function readouts(dock) {
  return dock.getByRole('table', { name: 'Readouts' }).innerText();
}

test('Time machine: ← and → step through draws, the scrubber and a typed draw land on the same seed as a fresh run', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(URL);
  const dock = page.getByTestId('station-dock');
  const tm = dock.getByRole('group', { name: 'Time machine' });
  const drawBox = tm.getByLabel('Draw number, typed value');
  await expect(dock.getByRole('table', { name: 'Readouts' })).toBeVisible();
  const stop = dock.getByRole('button', { name: 'Stop the experiment' });
  if (await stop.count()) await stop.click();

  await page.locator('body').focus();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('n');
  }
  await expect(drawBox).toHaveValue('5');
  await expect(page).toHaveURL(/seed=11(&|$)/, { timeout: 5000 });
  await expect(tm).toContainText('of 5');

  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(drawBox).toHaveValue('3');
  await expect(page).toHaveURL(/seed=9(&|$)/, { timeout: 5000 });
  await expect(tm).toContainText('of 5'); // the reach is kept
  const atThree = await readouts(dock);
  await page.keyboard.press('ArrowRight');
  await expect(drawBox).toHaveValue('4');
  await expect(page).toHaveURL(/seed=10(&|$)/, { timeout: 5000 });

  // A typed draw number.
  await drawBox.fill('3');
  await drawBox.press('Enter');
  await expect(drawBox).toHaveValue('3');
  await expect.poll(() => readouts(dock)).toBe(atThree);

  // The scrubber.
  const scrub = tm.getByRole('slider', { name: 'Draw on screen' });
  await scrub.fill('5');
  await expect(drawBox).toHaveValue('5');
  await expect(page).toHaveURL(/seed=11(&|$)/, { timeout: 5000 });
  const atFive = await readouts(dock);

  // A fresh run at seed 9 and seed 11 shows the same readouts as draws 3 and 5.
  await page.goto(URL.replace('seed=7', 'seed=9'));
  await expect.poll(() => readouts(dock)).toBe(atThree);
  await page.goto(URL.replace('seed=7', 'seed=11'));
  await expect.poll(() => readouts(dock)).toBe(atFive);
});

test('Time machine: the pace is typed between ¼ and 8', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(URL);
  const dock = page.getByTestId('station-dock');
  const pace = dock.getByLabel('Pace, typed multiplier');
  await pace.fill('0,25');
  await pace.press('Enter');
  await expect(pace).toHaveValue('0.25');
  await pace.fill('50');
  await pace.press('Enter');
  await expect(pace).toHaveValue('8');
  await pace.fill('3');
  await pace.press('Enter');
  await expect(pace).toHaveValue('3');
});
