/*
 * Aplica el tema antes del primer pintado.
 *
 * ── Por qué es un archivo aparte y no parte del bundle ────────────────────────
 * Todo lo demás de esta extensión son módulos, y un módulo se ejecuta **después** de que
 * el navegador haya parseado el documento: para entonces ya ha pintado el fondo del CSS.
 * En modo noche eso es un fogonazo blanco cada vez que se abre el popup. La forma clásica
 * de evitarlo es un `<script>` en línea en la cabecera, y aquí no se puede: el CSP de esta
 * extensión es `script-src 'self'`, sin `unsafe-inline`, y no se va a relajar por un color.
 *
 * Un archivo de `public/` referenciado sin `defer` ni `type="module"` bloquea el parseo y
 * se ejecuta en el sitio exacto donde estaría el script en línea. Mismo resultado, mismo
 * CSP.
 *
 * ── Por qué no está en TypeScript ─────────────────────────────────────────────
 * Nada de `public/` pasa por el bundler: se copia tal cual a la raíz de la extensión. Aquí
 * se escribe el JavaScript que va a ejecutar el navegador.
 *
 * La lógica de resolución se repite en `src/ui/themeMode.ts`, que es quien la cambia en
 * caliente. Son cinco líneas y viven en mundos distintos —una antes del bundle y otra
 * dentro—; unificarlas costaría más de lo que vale.
 */
(function applyStoredTheme() {
  var night = false;

  try {
    var stored = localStorage.getItem('pv.theme');
    night =
      stored === 'night' ||
      ((stored === null || stored === 'system') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch (error) {
    // `localStorage` puede lanzar si el almacenamiento está bloqueado por política. No es
    // motivo para dejar la extensión sin tema: se cae al claro, que es el valor por defecto.
    night = false;
  }

  document.documentElement.dataset.theme = night ? 'night' : 'light';
})();
