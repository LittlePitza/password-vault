import { browser } from 'wxt/browser';
import { CLIPBOARD_CLEAR_SECONDS } from '../core/policy';

/**
 * Auto-limpieza del portapapeles tras copiar una contraseña.
 *
 * ── Por qué esto no puede vivir en el popup ───────────────────────────────────
 * Lo natural sería un `setTimeout` justo después de copiar. No funciona: el popup se
 * **destruye** en cuanto pierde el foco, que es exactamente lo que pasa al ir a pegar la
 * contraseña en la página. El temporizador moriría con él y el secreto se quedaría en el
 * portapapeles indefinidamente.
 *
 * Tampoco sirve un `setTimeout` en el service worker: MV3 lo mata a los ~30 s.
 *
 * Queda una sola vía: una **alarma**, que sobrevive y despierta al worker. Pero el worker
 * no tiene DOM y el portapapeles necesita uno, así que la escritura se delega en un
 * **documento offscreen** — la API que existe justamente para este caso.
 *
 * ── Lo que se pierde ──────────────────────────────────────────────────────────
 * El borrado es incondicional: no se comprueba si el portapapeles sigue conteniendo
 * nuestra contraseña. Comprobarlo exigiría el permiso `clipboardRead`, que da acceso a
 * **todo** lo que el usuario copie, dentro y fuera de la extensión. En un gestor de
 * contraseñas ese permiso cuesta más de lo que vale: el precio de no pedirlo es que si
 * copias otra cosa dentro de los 30 s, también se borra.
 */

const ALARM_NAME = 'clipboard-clear';

/** Chrome ignora retrasos por debajo de 30 s; 0.5 min es justo el mínimo aceptado. */
const DELAY_IN_MINUTES = CLIPBOARD_CLEAR_SECONDS / 60;

export function scheduleClipboardClear(): void {
  // Con el mismo nombre la alarma se reemplaza: copiar dos veces seguidas reinicia la
  // cuenta atrás en vez de dejar dos borrados en cola.
  void browser.alarms.create(ALARM_NAME, { delayInMinutes: DELAY_IN_MINUTES });
}

/** Registra el disparador. Debe llamarse en el arranque del service worker. */
export function registerClipboardClear(): void {
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) void clearClipboard();
  });
}

async function clearClipboard(): Promise<void> {
  // Si quedó abierto uno de una limpieza anterior, `createDocument` fallaría: sólo puede
  // existir un documento offscreen a la vez.
  await closeAnyOpenDocument();

  await browser.offscreen.createDocument({
    // La instrucción viaja en la URL en vez de por mensaje: así el documento actúa al
    // cargarse y no hay que mantener un canal abierto ni ampliar el protocolo RPC.
    url: 'offscreen.html?action=clear',
    reasons: ['CLIPBOARD'],
    justification: 'Borrar del portapapeles la contraseña copiada por el usuario.',
  });
}

async function closeAnyOpenDocument(): Promise<void> {
  const contexts = await browser.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length > 0) await browser.offscreen.closeDocument();
}
