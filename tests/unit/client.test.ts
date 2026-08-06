import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { browser } from 'wxt/browser';
import { send } from '@/src/messaging/client';

/**
 * El cliente de mensajería, en sus caminos de fallo.
 *
 * El camino feliz ya lo cubren los tests del servicio: lo que aquí importa es lo
 * contrario, que **nada** de lo que salga mal en el canal se convierta en una promesa
 * rechazada. Todos los llamadores hacen `const r = await send(...)` seguido de
 * `if (r.ok)`, sin `try/catch`; si `send` pudiera lanzar, el fallo escaparía a un
 * manejador de React y dejaría la pantalla congelada en vez de mostrar un error.
 */
/**
 * Fija lo que `sendMessage` devuelve.
 *
 * El cast es inevitable: la API está declarada como `Promise<void>` porque el navegador
 * no puede saber qué forma tiene la respuesta de cada extensión. Nosotros sí lo sabemos
 * —la fija `route()` en background.ts— y simularla es justamente el objeto de este test.
 */
function respondWith(response: unknown) {
  return vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue(response as never);
}

describe('send()', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.restoreAllMocks();
  });

  it('convierte el rechazo del canal en un error, sin lanzar', async () => {
    // Es lo que ocurre de verdad cuando el service worker aún no ha despertado o la
    // extensión se recargó con el popup abierto.
    vi.spyOn(browser.runtime, 'sendMessage').mockRejectedValue(
      new Error('Could not establish connection'),
    );

    const response = await send({ type: 'vault/lock' });

    expect(response.ok).toBe(false);
    if (!response.ok) expect(response.error.kind).toBe('unexpected');
  });

  it('trata la ausencia de respuesta como error en vez de devolver undefined', async () => {
    // `sendMessage` resuelve a `undefined` si ningún receptor respondió. Sin la guarda,
    // el llamador recibiría un `undefined` disfrazado y reventaría al leer `.ok`.
    respondWith(undefined);

    const response = await send({ type: 'vault/lock' });

    expect(response.ok).toBe(false);
  });

  it('deja pasar intacta la respuesta del service worker', async () => {
    respondWith({ ok: true, value: null });

    await expect(send({ type: 'vault/lock' })).resolves.toEqual({ ok: true, value: null });
  });

  it('propaga también los fallos esperados, sin confundirlos con los del canal', async () => {
    respondWith({ ok: false, error: { kind: 'wrong-password' } });

    const response = await send({ type: 'vault/unlock', masterPassword: 'da igual' });

    expect(response.ok).toBe(false);
    if (!response.ok) expect(response.error.kind).toBe('wrong-password');
  });
});
