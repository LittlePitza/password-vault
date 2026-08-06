import { browser } from 'wxt/browser';
import type { RequestOf, RequestType, Response } from './protocol';

/**
 * Cliente tipado para hablar con el service worker desde el popup o las páginas.
 *
 * El genérico ata la petición a su respuesta: pedir `vault/list` devuelve
 * `readonly ItemSummary[]`, y pedir `vault/reveal` devuelve `VaultItem`. No hay casts
 * en el lado del llamador.
 */
export async function send<T extends RequestType>(request: RequestOf<T>): Promise<Response<T>> {
  const response: unknown = await browser.runtime.sendMessage(request);
  // El service worker es el único emisor posible y siempre responde con esta forma
  // (ver `route()` en background.ts); no hay nada que validar del lado del cliente.
  return response as Response<T>;
}
