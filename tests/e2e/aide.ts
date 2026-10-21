import { expect, type Page } from '@playwright/test';

/**
 * Attend que l'application soit prête : les catégories par défaut ne
 * s'affichent qu'une fois les dépôts chargés depuis IndexedDB.
 */
export async function attendreApplicationPrete(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Aujourd’hui' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nouveau bloc' })).toBeVisible();
}

/** Ouvre l'application sur la journée du jour et attend qu'elle soit prête. */
export async function allerAujourdhui(page: Page): Promise<void> {
  await page.goto('/#/jour');
  await attendreApplicationPrete(page);
}

/** Ouvre la feuille de création et attend que les données soient prêtes. */
export async function ouvrirFeuilleCreation(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Nouveau bloc' }).click();
  await expect(page.getByRole('heading', { name: 'Nouveau bloc' })).toBeVisible();
  // La puce « Travail » n'apparaît qu'une fois les catégories chargées.
  await expect(page.getByRole('button', { name: 'Travail' })).toBeVisible();
}

/**
 * Le nom accessible d'un bloc de timeline est « Titre 09:00 – 10:00 » :
 * on cible donc le texte du titre plutôt qu'un rôle.
 */
export function blocDansTimeline(page: Page, titre: string) {
  return page.locator('.tblock-title', { hasText: titre });
}

/**
 * Crée un bloc depuis la feuille de création, à heure fixe pour ne pas
 * dépendre de l'heure courante, et vérifie son affichage dans la timeline.
 */
export async function creerBloc(page: Page, titre: string): Promise<void> {
  await ouvrirFeuilleCreation(page);
  await page.getByLabel('Titre').fill(titre);
  await page.getByLabel('Début').fill('09:00');
  await page.getByLabel('Fin').fill('10:00');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('heading', { name: 'Nouveau bloc' })).toBeHidden();
  await expect(blocDansTimeline(page, titre)).toBeVisible();
}
