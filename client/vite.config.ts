import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// Phaser ve Three.js ayrı parçalara bölünür; böylece tarayıcı önbelleği
// oyun kodu değişse de motorları yeniden indirmez.
export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) return 'phaser';
          if (id.includes('node_modules/three')) return 'three';
        },
      },
    },
  },
});
