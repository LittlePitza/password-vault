import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/**
 * El valor de esta configuración no está en el formato — de eso se encarga Prettier —
 * sino en las **fronteras arquitectónicas** que impone más abajo: son las que mantienen
 * `src/core/` puro y testeable sin navegador, y las que impiden que una llave acabe en
 * la UI o en un log.
 */
export default defineConfig([
  {
    ignores: [
      '.wxt/**',
      '.output/**',
      'node_modules/**',
      'dist/**',
      'coverage/**',
      // `public/` se copia tal cual a la raíz de la extensión: no pasa por el bundler ni
      // por el tsconfig, así que las reglas con información de tipos no pueden aplicarse.
      'public/**',
    ],
  },

  {
    files: ['**/*.{ts,tsx,js}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: {
          // Este propio archivo no está incluido en el tsconfig del proyecto.
          allowDefaultProject: ['eslint.config.js'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser, ...globals.webextensions },
    },
    rules: {
      // `any` desactiva el compilador justo donde más lo necesitamos. Se usa `unknown`
      // y se valida con zod en la frontera.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],

      // Un catch vacío en código criptográfico esconde exactamente el fallo que importa.
      'no-empty': ['error', { allowEmptyCatch: false }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },

  // ── Frontera 1: el núcleo es TypeScript puro ───────────────────────────────────
  // Sin chrome.*, sin DOM, sin React. Es lo que permite testear toda la criptografía en
  // Node, y lo que haría que añadir Firefox fuese escribir un adaptador en vez de tocar
  // el núcleo. El acceso a plataforma entra por los puertos de core/ports.ts.
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'chrome', message: 'core/ no toca APIs del navegador. Usa un puerto de ports.ts.' },
        {
          name: 'browser',
          message: 'core/ no toca APIs del navegador. Usa un puerto de ports.ts.',
        },
        { name: 'window', message: 'core/ debe poder ejecutarse en Node (tests).' },
        { name: 'document', message: 'core/ debe poder ejecutarse en Node (tests).' },
        { name: 'localStorage', message: 'La bóveda va en chrome.storage vía puerto.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', '@/entrypoints/*', '@/src/platform/*', '@/src/ui/*'],
              message: 'core/ no depende de UI ni de plataforma. Invierte la dependencia.',
            },
          ],
        },
      ],
      // Un console.log con una contraseña dentro queda escrito en el log del navegador.
      'no-console': 'error',
    },
  },

  // ── Frontera 2: la UI nunca toca la criptografía ───────────────────────────────
  // Popup, páginas y content script piden datos por mensaje al service worker. Las
  // llaves no cruzan esta línea.
  {
    files: ['src/ui/**/*.{ts,tsx}', 'entrypoints/popup/**', 'entrypoints/vault/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/src/core/crypto/*', '@/src/platform/*'],
              message: 'La UI accede a la bóveda por messaging/, nunca directo a las llaves.',
            },
          ],
        },
      ],
    },
  },

  // ── React ─────────────────────────────────────────────────────────────────────
  // `configs.recommended` sigue siendo el formato eslintrc antiguo (plugins como array
  // de strings). El de flat config vive bajo `configs.flat`.
  {
    files: ['**/*.tsx'],
    extends: [reactHooks.configs.flat.recommended],
  },

  // ── Tests ─────────────────────────────────────────────────────────────────────
  {
    files: ['tests/**/*.ts', '**/*.test.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      'no-console': 'off',
    },
  },

  // ── Archivos de configuración ─────────────────────────────────────────────────
  {
    files: ['*.config.{ts,js}', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
]);
