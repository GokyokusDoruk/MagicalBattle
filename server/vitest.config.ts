import { defineConfig } from 'vitest/config';

// Hızlı birim testleri. Gerçek veritabanı testleri ayrı: `npm run test:db`.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
  },
});
