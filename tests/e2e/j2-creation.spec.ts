import { test, expect } from '@playwright/test';
import { allerAujourdhui, attendreApplicationPrete, blocDansTimeline, creerBloc } from './aide';

test.beforeEach(async ({ page }) => {
  await allerAujourdhui(page);
});

test('J2 - creation d’un bloc sur Aujourd’hui', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Aujourd’hui' })).toBeVisible();

  await page.getByRole('button', { name: 'Nouveau bloc' }).click();
  await expect(page.getByRole('heading', { name: 'Nouveau bloc' })).toBeVisible();

  await page.getByLabel('Titre').fill('Réunion équipe');
  await page.getByLabel('Début').fill('09:00');
  await page.getByLabel('Fin').fill('10:00');
  await page.getByRole('button', { name: 'Travail' }).click();
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  // La feuille se ferme et le bloc apparaît dans la timeline.
  await expect(page.getByRole('heading', { name: 'Nouveau bloc' })).toBeHidden();
  await expect(blocDansTimeline(page, 'Réunion équipe')).toBeVisible();
  await expect(page.locator('.tblock-time', { hasText: '09:00' })).toBeVisible();
});

test('J2 - le titre est obligatoire', async ({ page }) => {
  await page.getByRole('button', { name: 'Nouveau bloc' }).click();
  await expect(page.getByRole('heading', { name: 'Nouveau bloc' })).toBeVisible();

  // Enregistrer sans titre : la feuille reste ouverte avec une erreur.
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.locator('.sheet-error')).toHaveText('Le titre est requis.');
  await expect(page.getByRole('heading', { name: 'Nouveau bloc' })).toBeVisible();
});

test('J2 - un bloc créé est conservé après rechargement', async ({ page }) => {
  await creerBloc(page, 'Réunion conservée');
  await page.reload();
  await attendreApplicationPrete(page);
  await expect(blocDansTimeline(page, 'Réunion conservée')).toBeVisible();
});
