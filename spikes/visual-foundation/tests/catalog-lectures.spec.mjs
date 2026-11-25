import { expect, test } from '@playwright/test';

// Independent expected course-index mapping: #79, requested explicitly by #92.
// Course titles for L11/L12 disagree with parts of their extracted body text;
// this task fixes the catalog's index tags, not lecture scripts or kernel content.
const expected = {
  urn: 'L1', frequency: 'L1', darts: 'L1 · L4', bayes: 'L1 · L2', bernoulli: 'L3 · L9',
  distribution: 'L5', moments: 'L6', transform: 'L6', scatter: 'L6',
  convolution: 'L6', convergence: 'L7', lln: 'L7', clt: 'L8 · L9',
  sample: 'L10', fit: 'L10 · L11', estimation: 'L12', confidence: 'L12',
  testing: 'L11', homogeneity: 'L11', randomness: 'extra', 'contract-fixture': 'L1',
};
const expectedOrbits = {
  probability: ['L1–L3', 'ЛЕКЦИИ 1–3'], variables: ['L4–L6', 'ЛЕКЦИИ 4–6'],
  limits: ['L6–L9', 'ЛЕКЦИИ 6–9'], statistics: ['L10–L12', 'ЛЕКЦИИ 10–12'],
};
const russian = tag => tag === 'extra' ? 'Вне лекций'
  : `${tag.includes('·') ? 'Лекции' : 'Лекция'} ${tag.replace(/L/g, '')}`;

for (const language of ['en', 'ru']) {
  test(`every catalog station renders its course-index lecture tag (${language})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/?lang=${language}#orbit/probability`);
    // Check the complete live inventory, so adding a station requires a reviewed mapping.
    const ids = await page.evaluate(async () => (await import('/src/stations/catalog.ts')).stations.map(s => s.id));
    expect([...ids].sort()).toEqual(Object.keys(expected).sort());
    for (const [id, tag] of Object.entries(expected)) {
      await page.goto(`/?lang=${language}#station/${id}`);
      await expect(page.getByTestId('station-dock')).toBeVisible();
      await expect.soft(page.locator('.dock-lecture'), id).toHaveText(language === 'en' ? `Lecture ${tag}` : russian(tag), { timeout: 1000 });
    }
  });

  test(`every orbit renders the course lecture range (${language})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const [id, ranges] of Object.entries(expectedOrbits)) {
      await page.goto(`/?lang=${language}#orbit/${id}`);
      await expect(page.locator('.orbit-heading .edition')).toContainText(ranges[language === 'en' ? 0 : 1]);
    }
  });
}
