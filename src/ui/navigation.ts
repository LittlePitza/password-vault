import { flushSync } from 'react-dom';

/** Hacia dónde va el usuario. Decide de qué lado entra y sale cada pantalla. */
export type Direction = 'forward' | 'back';

/**
 * Cambia de pantalla animando **las dos**: la que se va y la que llega.
 *
 * ── El problema que resuelve ──────────────────────────────────────────────────
 * Una animación de entrada se hace con `@keyframes` y ya está. Una de salida no: cuando
 * React deja de renderizar un componente, el nodo desaparece del DOM en ese mismo
 * fotograma y no queda nada que animar. La solución habitual es una librería que retrasa
 * el desmontaje (`framer-motion`, `react-transition-group`) manteniendo el árbol viejo
 * vivo un rato — y eso, en esta interfaz, significaría mantener vivo un rato el componente
 * que tiene una contraseña descifrada en su estado.
 *
 * La API de transiciones del navegador no hace eso. Toma una **captura** de la pantalla
 * anterior, deja que React desmonte y anima la imagen. Cuando la animación corre, el
 * componente viejo ya no existe: lo que se mueve es un mapa de bits. Sale gratis en
 * memoria, sale gratis en secretos y no añade una sola dependencia.
 *
 * ── Por qué `flushSync` ───────────────────────────────────────────────────────
 * El navegador captura el estado nuevo en cuanto vuelve el callback. React 19 agrupa las
 * actualizaciones y las aplica después, así que sin `flushSync` capturaría la pantalla
 * vieja dos veces y no se movería nada.
 */
export function navigate(direction: Direction, update: () => void): void {
  const root = document.documentElement;

  // Chrome tiene esto desde la 111 y Edge desde la misma base. Si faltara —o si el
  // usuario pidió menos movimiento— el cambio de pantalla ocurre igual, sin animar.
  const supported = 'startViewTransition' in document;
  const wantsMotion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!supported || !wantsMotion) {
    update();
    return;
  }

  // El CSS lee este atributo para decidir el sentido del deslizamiento.
  root.dataset.nav = direction;

  const transition = document.startViewTransition(() => {
    flushSync(update);
  });

  void transition.finished.finally(() => {
    delete root.dataset.nav;
  });
}
