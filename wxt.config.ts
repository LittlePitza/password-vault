import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],

  manifest: {
    name: 'Password Vault',
    description: 'Gestor de contraseñas local. La bóveda nunca sale de este dispositivo.',
    version: '0.1.0',

    /*
     * Cada permiso aquí es una frase más en el diálogo de instalación y una pregunta más
     * en la revisión de la tienda, así que la lista es exactamente lo que se usa.
     *
     * En concreto NO están, aunque un gestor de contraseñas parezca necesitarlos:
     *
     *  · `host_permissions` / `<all_urls>` — el content script se declara abajo con sus
     *    `matches`, y en MV3 ese patrón ya es la autorización para inyectarlo. Pedir
     *    además acceso general a todos los sitios no añadiría ninguna capacidad.
     *  · `scripting` — sólo hace falta para inyectar código a mano. El nuestro es
     *    declarativo.
     *  · `activeTab` — es el permiso para actuar sobre la pestaña activa tras un clic en
     *    el icono. El autocompletado no pasa por ahí.
     *  · `tabs` — daría la URL y el título de cualquier pestaña. No hace falta: el origen
     *    de un mensaje llega en `sender.url`, que rellena el navegador, y `tabs.create`
     *    (el onboarding) funciona sin permiso.
     */
    permissions: [
      'storage', // bóveda cifrada (local) + llave de sesión (session)
      'alarms', // auto-bloqueo y limpieza del portapapeles
      'idle', // bloquear cuando el equipo queda inactivo
      // Documento sin interfaz que borra el portapapeles. Es la única forma en MV3 de
      // tocarlo desde el service worker, que no tiene DOM. No implica `clipboardRead`:
      // se escribe encima, nunca se lee lo que el usuario copia.
      'offscreen',
    ],

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
