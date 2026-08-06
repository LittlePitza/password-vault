import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],

  manifest: {
    name: 'Password Vault',
    description: 'Gestor de contraseñas local. La bóveda nunca sale de este dispositivo.',
    version: '0.1.0',

    permissions: [
      'storage', // bóveda cifrada (local) + llave de sesión (session)
      'alarms', // auto-bloqueo y limpieza del portapapeles
      'idle', // bloquear cuando el equipo queda inactivo
      // Documento sin interfaz que borra el portapapeles. Es la única forma en MV3 de
      // tocarlo desde el service worker, que no tiene DOM. No implica `clipboardRead`:
      // se escribe encima, nunca se lee lo que el usuario copia.
      'offscreen',
      'activeTab',
      'scripting',
      'tabs', // leer la URL de la pestaña para sugerir credenciales
    ],

    host_permissions: ['<all_urls>'], // necesario para autocompletar en cualquier sitio

    // Máxima rigidez: sin 'wasm-unsafe-eval'. La derivación de llave usa scrypt en JS
    // puro (@noble/hashes), justamente para no tener que relajar esta política.
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';",
    },
  },

  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
