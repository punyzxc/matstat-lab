import { expect, test } from '@playwright/test';

// #118: particles flow down the tree; inverse mode regroups by A; a typed prior changes the widths and the formula.
test('Bayes tree: forward widths, inverse posteriors, a typed prior updates the tree and the formula', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#station/bayes-tree?seed=3&q1=0.5&q2=0.3&q3=0.2&l1=0.2&l2=0.5&l3=0.9&n=4000');
  const dock = page.getByTestId('station-dock');
  const tree = dock.getByRole('region', { name: 'Bayes tree' });
  await expect(tree).toHaveAttribute('data-mode', 'forward');
  await expect(tree.locator('.bt-particle')).toHaveCount(90);
  const formula = dock.getByRole('group', { name: 'Live formula' });
  await expect(formula).toContainText('0.43');
  const w = async (id) => Number(await tree.locator(`[data-edge="${id}"]`).evaluate((e) => parseFloat(getComputedStyle(e).strokeWidth)));
  expect(await w('e-root-H0')).toBeCloseTo(44 * 0.5, 0);
  expect(await w('e-root-H2')).toBeCloseTo(44 * 0.2, 0);

  await tree.getByRole('radio', { name: /Inverse/ }).click();
  await expect(tree).toHaveAttribute('data-mode', 'inverse');
  await expect(tree).toContainText('0.419'); // P(H3 | A) = 0.18 / 0.43
  expect(await w('e-root-A')).toBeCloseTo(44 * 0.43, 0);

  // A typed prior: the priors are rescaled to a complete group and the formula follows.
  const q1 = dock.getByLabel(/Prior P\(H₁\), typed value/);
  await q1.fill('0.8');
  await q1.press('Enter');
  await expect(formula).toContainText('0.6154'); // 0.8 / 1.3
  await expect(page).toHaveURL(/q1=0\.8/, { timeout: 5000 });
});

test('Bayes tree opens on the main scene from the total-probability step of lecture 2', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#lecture/2/2');
  await page.getByRole('link', { name: /Watch the particles in the Bayes tree/ }).first().click();
  await expect(page).toHaveURL(/#station\/bayes-tree\?seed=118&/);
  await expect(page.getByTestId('station-dock').getByRole('heading', { name: 'Bayes tree', exact: true })).toBeVisible();
});
