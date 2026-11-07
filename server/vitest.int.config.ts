import { defineConfig } from 'vitest/config';

// Gerçek PostgreSQL'e karşı entegrasyon testleri (gömülü PostgreSQL başlatır).
export default defineConfig({
  test: {
    include: ['test/**/*.int.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
