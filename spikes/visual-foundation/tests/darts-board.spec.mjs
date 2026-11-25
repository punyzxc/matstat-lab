import { expect, test } from '@playwright/test';

// #90: Buffon's needle with typed l and d; a region typed as inequalities, with inline errors.
test("Buffon's needle: needles fall, the estimate of π and its band, typed l and d, Buffon fields only in that view", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/darts?seed=5&view=2&N=4000');
  const dock = page.getByTestId('station-dock');
  await expect(dock.getByLabel(/Needle length l, typed value/)).toHaveCount(0);
  await dock.getByRole('radio', { name: "Buffon's needle", exact: true }).click();
  const board = dock.locator('figure.board');
  await expect(board.locator('.board-needle')).toHaveCount(80);
  await expect(dock.getByRole('group', { name: 'Live formula' })).toContainText('π');
  const l = dock.getByLabel(/Needle length l, typed value/);
  await l.fill('0.5');
  await l.press('Enter');
  await expect(page).toHaveURL(/l=0\.5/, { timeout: 5000 });
  // The board counts the needles it draws: the shown count matches the lit needles.
  const lit = await board.locator('.board-needle[data-hit]').count();
  await expect(board.locator('.board-count')).toHaveAttribute('data-count', String(lit));
  await expect(dock.getByRole('table', { name: 'Readouts' })).toContainText('Estimate');
});

test('A typed region: darts land in it, an invalid region is explained and the last valid one keeps playing, the link replays it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/darts?seed=9&view=4&N=4000');
  const dock = page.getByTestId('station-dock');
  const field = dock.getByRole('textbox', { name: 'Region A in the unit square', exact: true });
  await expect(field).toHaveValue('y < x^2');
  const board = dock.locator('figure.board--region');
  await expect(board.locator('.board-dart')).toHaveCount(400);
  const formula = dock.getByRole('group', { name: 'Live formula' });
  await expect(formula).toContainText('y<x2');

  await field.fill('x^2 + y^2 < 1');
  await field.press('Enter');
  await expect(page).toHaveURL(/region=x%5E2%20%2B%20y%5E2%20%3C%201/, { timeout: 5000 });
  await expect(dock.getByRole('table', { name: 'Readouts' })).toContainText('0.7854');

  await field.fill('y < z');
  await field.press('Enter');
  await expect(dock.getByRole('alert')).toContainText('z needs the cube'); // #119: z is a coordinate of the cube
  await expect(dock.getByRole('alert')).toContainText('Still playing: x^2 + y^2 < 1');
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(dock.getByRole('table', { name: 'Readouts' })).toContainText('0.7854');

  await dock.getByRole('button', { name: '0.2 < x < 0.8 or y > 0.9' }).click();
  await expect(field).toHaveValue('0.2 < x < 0.8 or y > 0.9');
  await expect(dock.getByRole('alert')).toHaveCount(0);
  await expect(dock.getByRole('table', { name: 'Readouts' })).toContainText('0.64');

  // The link keeps the region: reloading it replays the same region (the kernel test checks the same seed gives the same bytes).
  await expect(page).toHaveURL(/region=0\.2%20%3C%20x%20%3C%200\.8%20or%20y%20%3E%200\.9/, { timeout: 5000 });
  const url = page.url();
  await page.goto('about:blank');
  await page.goto(url);
  await expect(dock.getByRole('textbox', { name: 'Region A in the unit square', exact: true })).toHaveValue('0.2 < x < 0.8 or y > 0.9');
  await expect(dock.getByRole('group', { name: 'Live formula' })).toContainText('∨');
});

test('Russian: region errors are translated', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('statum-lab:lang', 'ru'));
  await page.goto('/#station/darts?seed=9&view=4&N=1000');
  const dock = page.getByTestId('station-dock');
  const field = dock.getByRole('textbox', { name: 'Область A в единичном квадрате', exact: true });
  await field.fill('y < q');
  await field.press('Enter');
  await expect(dock.getByRole('alert')).toContainText('Неизвестное имя «q»');
});

// #124: Bertrand's paradox, three circles; a circle in focus lights its formula line.
test('Bertrand: three circles draw their chords, shares next to 1/2, 1/3, 1/4, hover lights the formula line', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/darts?seed=6&view=2&N=4000');
  const dock = page.getByTestId('station-dock');
  const circles = dock.locator('.chord-circle');
  await expect(circles).toHaveCount(3);
  await expect(circles.nth(0).locator('.chord')).toHaveCount(36);
  await expect(circles.nth(0)).toContainText('→ 1/2');
  await expect(circles.nth(1)).toContainText('→ 1/3');
  await expect(circles.nth(2)).toContainText('→ 1/4');
  const lines = dock.locator('.live-formula-line');
  await expect(lines).toHaveCount(3);
  await circles.nth(1).hover();
  await expect(lines.nth(1)).toHaveAttribute('data-on', 'true');
  await expect(lines.nth(0)).not.toHaveAttribute('data-on', /.*/);
  await circles.nth(2).focus();
  await expect(lines.nth(2)).toHaveAttribute('data-on', 'true');
  await expect(lines.nth(1)).not.toHaveAttribute('data-on', /.*/);
});
