import { describe, expect, it } from 'vitest';
import { generateInstallationToken } from './installation';

describe('generateInstallationToken', () => {
  it(' produit un jeton hexadécimal de 64 caractères', () => {
    const token = generateInstallationToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it(' produit des jetons uniques', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateInstallationToken()));
    expect(tokens.size).toBe(100);
  });
});
