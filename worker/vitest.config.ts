import { defineConfig } from 'vitest/config';

// Config propre au worker : sans elle, Vitest remonte jusqu'au vite.config.ts
// de la racine du dépôt, qui importe des dépendances applicatives absentes
// des dépendances du service de rappels.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
