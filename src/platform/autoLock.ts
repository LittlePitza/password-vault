import { browser } from 'wxt/browser';
import { AUTO_LOCK_MINUTES } from '../core/policy';

/**
 * Auto-bloqueo por inactividad.
 *
 * Se apoya en dos señales distintas porque cubren descuidos distintos:
 *
 *  · `alarms` — el usuario dejó de usar la extensión pero sigue trabajando. Se bloquea
 *    tras el plazo configurado.
 *  · `idle` — el usuario bloqueó la sesión de Windows o se levantó del sitio. Aquí no
 *    tiene sentido esperar el plazo: si la pantalla está bloqueada, la bóveda también.
 *
 * Se usan alarmas y no `setTimeout` por una razón concreta de MV3: el service worker
 * muere a los ~30 s y un `setTimeout` moriría con él, dejando la bóveda abierta para
 * siempre. Las alarmas sobreviven y despiertan al worker.
 */

const ALARM_NAME = 'vault-auto-lock';

/** Chrome ignora periodos por debajo de 30 s; el mínimo práctico es 1 minuto. */
export const MIN_AUTO_LOCK_MINUTES = 1;

/** El plazo lo fija la política del núcleo; aquí sólo se traduce a una alarma. */
export const DEFAULT_AUTO_LOCK_MINUTES = AUTO_LOCK_MINUTES;

export function scheduleAutoLock(minutes: number): void {
  const delay = Math.max(minutes, MIN_AUTO_LOCK_MINUTES);
  // `create` con el mismo nombre reemplaza la alarma anterior, así que cada actividad
  // reinicia la cuenta atrás en vez de acumular alarmas.
  void browser.alarms.create(ALARM_NAME, { delayInMinutes: delay });
}

export function cancelAutoLock(): void {
  void browser.alarms.clear(ALARM_NAME);
}

/** Registra los disparadores. Debe llamarse en el arranque del service worker. */
export function registerAutoLock(lock: () => Promise<void>): void {
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) void lock();
  });

  browser.idle.onStateChanged.addListener((state) => {
    // 'locked' es la sesión del sistema operativo bloqueada. 'idle' a secas no basta
    // para bloquear: sería molesto perder la sesión por ir a por un café.
    if (state === 'locked') void lock();
  });
}
