import { expect, test } from '@playwright/test';

// #117: drag or type A and B, condition on B, the independence marker, live points.
test('Conditional probability: drag and type the events, the independence marker, condition on B', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/conditional?seed=4&a=0.5&s=0.3&b=0.5&h=0.6&n=4000');
  const dock = page.getByTestId('station-dock');
  const square = dock.getByRole('region', { name: 'Events in the unit square' });
  const formula = dock.getByRole('group', { name: 'Live formula' });
  await expect(formula).toContainText('0.12');
  await expect(square.locator('[data-independent]')).toHaveCount(0);
  await expect(square.locator('.es-pt')).toHaveCount(600);

  // Arrow keys on the left edge of B: 0.30 → 0.25 makes A and B independent.
  const edge = square.getByRole('slider', { name: 'Left edge of B' });
  await edge.focus();
  for (let i = 0; i < 5; i++) await edge.press('ArrowLeft');
  await expect(square.locator('[data-independent]')).toBeVisible();
  await expect(formula).toContainText('=0.15');
  await expect(page).toHaveURL(/s=0\.25/, { timeout: 5000 });

  // Typing a width of A breaks it again.
  const a = dock.getByLabel(/Width of A, typed value/);
  await a.fill('0.6');
  await a.press('Enter');
  await expect(square.locator('[data-independent]')).toHaveCount(0);

  // Dragging the edge of A to the right widens it.
  const handle = square.getByRole('slider', { name: 'Width of A' });
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => Number(await handle.getAttribute('aria-valuenow'))).toBeGreaterThan(0.62);

  // Condition on B: B fills the square, the points outside B leave, the handles hide.
  const given = square.getByRole('button', { name: 'Condition on B' });
  await given.click();
  await expect(given).toHaveAttribute('aria-pressed', 'true');
  await expect(square).toHaveAttribute('data-given', 'true');
  await expect(square.getByRole('slider')).toHaveCount(0);
  const b = await square.locator('.es-b').boundingBox(), omega = await square.locator('.es-omega').boundingBox();
  expect(Math.abs(b.width - omega.width)).toBeLessThan(2);
  await expect(square).toContainText('P(A∣B)');
  await given.click();
  await expect(square.getByRole('slider')).toHaveCount(4);
});

test('Conditional probability opens on the main scene from the first step of lecture 2', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#lecture/2/1');
  await page.getByRole('link', { name: /Condition on B in the Conditional probability station/ }).first().click();
  await expect(page).toHaveURL(/#station\/conditional\?seed=202&a=0\.5&s=0\.3&b=0\.5&h=0\.6&lecture=2&step=1/);
  await expect(page.getByTestId('station-dock').getByRole('heading', { name: 'Conditional probability', exact: true })).toBeVisible();
});
