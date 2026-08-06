import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // El plugin de WXT aporta `fakeBrowser`: una implementación en memoria de las APIs de
  // extensión. Sirve para probar los adaptadores de `platform/` de verdad, en vez de
  // contra dobles escritos a mano que podrían no reflejar el comportamiento real.
  plugins: [WxtVitest()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },

  test: {
    globals: true,
    // El núcleo no toca el DOM ni chrome.*, así que corre en Node puro. Ese es el punto
    // de ports.ts: la criptografía se prueba sin navegador.
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/platform/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      reporter: ['text', 'html'],
    },
  },
});
