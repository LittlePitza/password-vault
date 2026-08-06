import { browser } from 'wxt/browser';
import { unexpected } from '../core/vault/errors';
import type { RequestOf, RequestType, Response } from './protocol';

/**
 * Cliente tipado para hablar con el service worker desde el popup o las páginas.
 *
 * El genérico ata la petición a su respuesta: pedir `vault/list` devuelve
 * `readonly ItemSummary[]`, y pedir `vault/reveal` devuelve `VaultItem`. No hay casts
 * en el lado del llamador.
 *
 * ── Por qué nunca rechaza ─────────────────────────────────────────────────────
 * Todos los llamadores hacen `const r = await send(...)` y siguen con `if (r.ok)`. Si
 * esta función pudiera rechazar, cada uno necesitaría además su propio `try/catch` — y el
 * día que a alguno se le olvidara, el fallo saldría como excepción sin capturar dentro de
 * un manejador de React, dejando la pantalla a medias y sin explicación.
 *
 * Así que un canal caído se devuelve como `{ ok: false }`, igual que una contraseña
 * incorrecta. El llamador ya sabe tratar eso.
 */
export async function send<T extends RequestType>(request: RequestOf<T>): Promise<Response<T>> {
  let response: unknown;

  try {
    response = await browser.runtime.sendMessage(request);
  } catch (cause) {
    // Pasa cuando el service worker aún no ha despertado, o si la extensión se recargó
    // con el popup abierto y el canal quedó apuntando a un contexto que ya no existe.
    console.error('[vault] no se pudo contactar con el service worker', cause);
    return { ok: false, error: unexpected(cause) };
  }

  // `sendMessage` resuelve a `undefined` si ningún receptor llegó a responder. Sin esta
  // comprobación el `as` de abajo produciría un `undefined` disfrazado de respuesta y el
  // llamador reventaría al leer `.ok` — lejos de aquí y sin rastro del motivo.
  if (response == null) {
    return { ok: false, error: unexpected('el service worker no devolvió respuesta') };
  }

  // Superado eso, el service worker es el único emisor posible y siempre responde con
  // esta forma (ver `route()` en background.ts).
  return response as Response<T>;
}
