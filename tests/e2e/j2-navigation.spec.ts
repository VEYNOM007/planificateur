import { test, expect } from '@playwright/test';
import { allerAujourdhui, blocDansTimeline, creerBloc } from './aide';

test.beforeEach(async ({ page }) => {
  await allerAujourdhui(page);
});

test('J2 - navigation entre jours (précédent/suivant) et retour à aujourd’hui', async ({
  page,
}) => {
  await expect(page.getByRole('heading', { name: 'Aujourd’hui' })).toBeVisible();

  // Suivant → Demain
  await page.getByRole('button', { name: 'Jour suivant' }).click();
  await expect(page.getByRole('heading', { name: 'Demain' })).toBeVisible();

  // Précédent → Aujourd’hui
  await page.getByRole('button', { name: 'Jour précédent' }).click();
  await expect(page.getByRole('heading', { name: 'Aujourd’hui' })).toBeVisible();

  // Précédent → Hier, puis retour via le bouton « Aujourd’hui »
  await page.getByRole('button', { name: 'Jour précédent' }).click();
  await expect(page.getByRole('heading', { name: 'Hier' })).toBeVisible();
  await page.getByRole('button', { name: 'Aujourd’hui', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Aujourd’hui' })).toBeVisible();
});

test('J2 - un bloc n’apparaît que sur son jour', async ({ page }) => {
  await creerBloc(page, 'Bloc du jour');

  // Le lendemain, le bloc n’est plus visible.
  await page.getByRole('button', { name: 'Jour suivant' }).click();
  await expect(page.getByRole('heading', { name: 'Demain' })).toBeVisible();
  await expect(blocDansTimeline(page, 'Bloc du jour')).toHaveCount(0);

  // Retour : le bloc est de nouveau là.
  await page.getByRole('button', { name: 'Aujourd’hui', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Aujourd’hui' })).toBeVisible();
  await expect(blocDansTimeline(page, 'Bloc du jour')).toBeVisible();
});
