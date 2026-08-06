import { browser } from 'wxt/browser';
import type { SessionStore } from '../core/ports';

/**
 * Adaptador de `SessionStore` sobre `browser.storage.session`.
 *
 * Esta clase resuelve el problema central de Manifest V3: el service worker muere a los
 * ~30 s de inactividad y se lleva por delante toda variable global — incluida la llave de
 * descifrado. `storage.session` vive **sólo en memoria**, nunca se escribe a disco, y
 * sobrevive a esos reinicios. La documentación de Chrome lo describe exactamente para
 * este caso: gestores de contraseñas que necesitan guardar secretos de desbloqueo.
 *
 * Se borra solo al cerrar el navegador, que es justo la semántica de bloqueo que
 * queremos.
 *
 * IMPORTANTE: nunca llamar a `storage.session.setAccessLevel()`. Por defecto este área
 * no es visible para los content scripts, y ahí es donde debe quedarse: un content script
 * corre dentro de una página potencialmente hostil.
 */
export class BrowserSessionStore implements SessionStore {
  async get(key: string): Promise<unknown> {
    const result = await browser.storage.session.get(key);
    return result[key] ?? null;
  }

  async set(key: string, value: unknown): Promise<void> {
    await browser.storage.session.set({ [key]: value });
  }

  async clear(): Promise<void> {
    await browser.storage.session.clear();
  }
}
