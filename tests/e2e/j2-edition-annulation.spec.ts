import { test, expect } from '@playwright/test';
import { allerAujourdhui, attendreApplicationPrete, blocDansTimeline, creerBloc } from './aide';

test.beforeEach(async ({ page }) => {
  await allerAujourdhui(page);
});

test('J2 - édition d’un bloc : le titre est mis à jour', async ({ page }) => {
  await creerBloc(page, 'Bloc à modifier');

  // Ouvrir la feuille d’édition
  await blocDansTimeline(page, 'Bloc à modifier').click();
  await expect(page.getByRole('heading', { name: 'Modifier le bloc' })).toBeVisible();

  await page.getByLabel('Titre').fill('Bloc modifié');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByRole('heading', { name: 'Modifier le bloc' })).toBeHidden();
  await expect(blocDansTimeline(page, 'Bloc modifié')).toBeVisible();
  await expect(blocDansTimeline(page, 'Bloc à modifier')).toHaveCount(0);
});

test('J2 - suppression puis annulation : le bloc revient', async ({ page }) => {
  await creerBloc(page, 'Bloc annulable');

  // Ouvrir puis supprimer
  await blocDansTimeline(page, 'Bloc annulable').click();
  await expect(page.getByRole('heading', { name: 'Modifier le bloc' })).toBeVisible();
  await page.getByRole('button', { name: 'Supprimer' }).click();

  // La barre d’annulation apparaît et le bloc disparaît de la timeline.
  await expect(page.getByRole('status')).toContainText('Bloc supprimé');
  await expect(blocDansTimeline(page, 'Bloc annulable')).toHaveCount(0);

  // Annulation : le bloc réapparaît.
  await page.locator('.undo-bar-action').click();
  await expect(blocDansTimeline(page, 'Bloc annulable')).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
});

test('J2 - la suppression est définitive après la fin du délai d’annulation', async ({ page }) => {
  await creerBloc(page, 'Bloc supprimé');

  await blocDansTimeline(page, 'Bloc supprimé').click();
  await expect(page.getByRole('heading', { name: 'Modifier le bloc' })).toBeVisible();
  await page.getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.getByRole('status')).toContainText('Bloc supprimé');

  // Le délai d’annulation est de 6 s : on attend qu’il soit écoulé.
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 10000 });

  // Après rechargement, le bloc est définitivement absent.
  await page.reload();
  await attendreApplicationPrete(page);
  await expect(blocDansTimeline(page, 'Bloc supprimé')).toHaveCount(0);
});
