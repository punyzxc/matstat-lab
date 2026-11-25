import { expect, test } from '@playwright/test';

// #129: the outcomes of Ω as objects; A and B typed or picked; union, product, complement with P = m/n.
test('Outcomes and events: typed A and B light up, the operations recount m and the live formula', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/events?seed=2&experiment=0&relA=0&a=9&relB=1&b=6&op=2');
  const dock = page.getByTestId('station-dock');
  const space = dock.getByRole('region', { name: 'Outcome space' });
  const cells = space.locator('.os-cell');
  await expect(cells).toHaveCount(36);
  await expect(space.locator('.os-cell[data-a]')).toHaveCount(10);
  await expect(space.locator('.os-cell[data-b]')).toHaveCount(6);
  await expect(space.locator('.os-cell[data-e]')).toHaveCount(12);
  const formula = dock.getByRole('group', { name: 'Live formula' });
  await expect(formula).toContainText('1036+636−436=1236');

  await dock.getByRole('radio', { name: /^product/ }).click();
  await expect(space.locator('.os-cell[data-e]')).toHaveCount(4);
  await dock.getByRole('radio', { name: /^complement/ }).click();
  await expect(space.locator('.os-cell[data-e]')).toHaveCount(26);
  await expect(page).toHaveURL(/op=4/);

  const a = dock.getByLabel(/Value a in A, typed value/);
  await a.fill('11');
  await a.press('Enter');
  await expect(space.locator('.os-cell[data-a]')).toHaveCount(3);
  await expect(space.locator('.os-cell[data-e]')).toHaveCount(33);
});

test('Outcomes and events: coins and cards are laid out as objects; trials converge in the readouts', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/events?seed=2&experiment=1&a=2&relB=1&b=1&op=2&n=20000');
  const dock = page.getByTestId('station-dock');
  const space = dock.getByRole('region', { name: 'Outcome space' });
  await expect(space.locator('.os-coin')).toHaveCount(24);
  await expect(space.locator('.os-cell[data-e]')).toHaveCount(5);
  const row = dock.getByRole('table', { name: 'Readouts' }).getByRole('row', { name: /the event shown/ });
  await expect(row).toContainText('0.625');
  await dock.getByRole('radio', { name: /deck of 36 cards/ }).click();
  await expect(space.locator('.os-card')).toHaveCount(36);
  await expect(space.locator('.os-card[data-red]')).toHaveCount(18);
  await expect(page).toHaveURL(/experiment=2/);
  // Same URL in a fresh page: same numbers.
  const url = page.url();
  const first = await row.textContent();
  const again = await page.context().newPage();
  await again.emulateMedia({ reducedMotion: 'reduce' });
  await again.goto(url);
  await expect(again.getByTestId('station-dock').getByRole('table', { name: 'Readouts' }).getByRole('row', { name: /the event shown/ })).toHaveText(first);
});
