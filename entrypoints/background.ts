import { browser } from 'wxt/browser';
import { VaultRepository } from '@/src/core/vault/vaultRepository';
import { VaultService } from '@/src/core/vault/vaultService';
import { cryptoIdGenerator, systemClock } from '@/src/core/ports';
import { corruptData } from '@/src/core/crypto/errors';
import { type VaultError, itemNotFound, unexpected } from '@/src/core/vault/errors';
import type { BackupError } from '@/src/core/vault/backup';
import { BrowserVaultStorage } from '@/src/platform/browserStorage';
import { BrowserSessionStore } from '@/src/platform/browserSession';
import {
  DEFAULT_AUTO_LOCK_MINUTES,
  cancelAutoLock,
  registerAutoLock,
  scheduleAutoLock,
} from '@/src/platform/autoLock';
import { registerClipboardClear, scheduleClipboardClear } from '@/src/platform/clipboard';
import { type Request, requestSchema } from '@/src/messaging/protocol';

/**
 * Service worker: **único** dueño de las llaves criptográficas.
 *
 * Ni el popup ni el content script las ven nunca. Piden operaciones por mensaje y
 * reciben datos ya descifrados, sólo del item concreto que solicitaron.
 *
 * Este archivo se re-ejecuta entero cada vez que el navegador revive el worker tras
 * matarlo por inactividad. Por eso no guarda estado en variables de módulo: todo lo que
 * debe sobrevivir vive en `storage.session` (la DEK) o en `storage.local` (la bóveda).
 */

const service = new VaultService({
  repository: new VaultRepository(new BrowserVaultStorage()),
  session: new BrowserSessionStore(),
  clock: systemClock,
  ids: cryptoIdGenerator,
});

/** Forma serializable de un `Result`: las excepciones no cruzan `sendMessage`. */
type AnyResponse =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: VaultError | BackupError };

const success = (value: unknown = null): AnyResponse => ({ ok: true, value });
const failure = (error: VaultError | BackupError): AnyResponse => ({ ok: false, error });

export default defineBackground(() => {
  registerAutoLock(async () => {
    await service.lock();
  });
  registerClipboardClear();

  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') {
      void browser.tabs.create({ url: browser.runtime.getURL('/onboarding.html') });
    }
  });

  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    // Se responde de forma asíncrona: hay que devolver `true` para que el canal siga
    // abierto hasta que llegue `sendResponse`.
    //
    // El `catch` es una red de seguridad, no el manejo principal: `route` ya captura lo
    // suyo. Está aquí para garantizar por construcción que **toda** rama termina llamando
    // a `sendResponse`, incluso si un día se cuela un fallo antes de ese `try`.
    void route(message, senderUrl(sender))
      .then(sendResponse)
      .catch((cause: unknown) => {
        console.error('[vault] fallo al enrutar el mensaje', cause);
        sendResponse(failure(unexpected(cause)));
      });
    return true;
  });
});

/**
 * De dónde salió el mensaje, según el navegador.
 *
 * `sender.url` lo rellena Chrome, no el remitente, y por eso es la única fuente admisible
 * para decidir a qué sitio se le entrega una credencial. Es la URL del **frame** concreto
 * que envió el mensaje: si un banco vive dentro de un iframe, lo que cuenta es el origen
 * del iframe y no el de la página que lo embebe, que es justo lo correcto — la política
 * de mismo origen ya impide a la página de fuera leer dentro.
 *
 * Para los mensajes del popup esto será una URL `chrome-extension://`, que no casa con
 * ningún dominio guardado. El autocompletado desde el popup simplemente no devuelve nada,
 * sin necesidad de comprobarlo aparte.
 */
function senderUrl(sender: { url?: string }): string | null {
  return sender.url ?? null;
}

async function route(message: unknown, pageUrl: string | null): Promise<AnyResponse> {
  // El content script vive dentro de páginas potencialmente hostiles: nada de lo que
  // llegue por aquí se da por bien formado, aunque venga de nuestra propia extensión.
  const parsed = requestSchema.safeParse(message);
  if (!parsed.success) {
    return failure(corruptData('mensaje con forma inválida'));
  }

  let response: AnyResponse;
  try {
    response = await handle(parsed.data, pageUrl);
  } catch (cause) {
    /*
     * Un caso de uso lanzó en vez de devolver su `Result`: cuota de `storage.local`
     * agotada, el almacenamiento caído, un fallo del navegador.
     *
     * Sin este `catch` la promesa se propagaría, `sendResponse` no llegaría a llamarse
     * nunca y el popup se quedaría esperando indefinidamente — el mismo síntoma que
     * "la extensión no hace nada al pulsar". Convertirlo en valor lo hace visible.
     */
    console.error('[vault] fallo no previsto en', parsed.data.type, cause);
    response = failure(unexpected(cause));
  }

  // Cualquier actividad legítima reinicia la cuenta atrás del auto-bloqueo. Va en su
  // propio `try`: que la operación fallara no es motivo para dejar la bóveda sin plazo.
  try {
    if (await service.isUnlocked()) {
      scheduleAutoLock(DEFAULT_AUTO_LOCK_MINUTES);
    } else {
      cancelAutoLock();
    }
  } catch (cause) {
    // Si no se puede ni consultar el estado, se programa el bloqueo igualmente. Ante la
    // duda, cerrar: una alarma de más no cuesta nada, una bóveda abierta sin plazo sí.
    console.error('[vault] no se pudo consultar el estado; se programa el bloqueo', cause);
    scheduleAutoLock(DEFAULT_AUTO_LOCK_MINUTES);
  }

  return response;
}

async function handle(request: Request, pageUrl: string | null): Promise<AnyResponse> {
  switch (request.type) {
    case 'vault/snapshot':
      return success(await service.snapshot());

    case 'vault/initialize': {
      const result = await service.initialize(request.masterPassword);
      return result.ok ? success(result.value) : failure(result.error);
    }

    case 'vault/unlock': {
      const result = await service.unlock(request.masterPassword);
      return result.ok ? success() : failure(result.error);
    }

    case 'vault/lock':
      await service.lock();
      return success();

    case 'vault/list': {
      const result = await service.listItems();
      return result.ok ? success(result.value) : failure(result.error);
    }

    case 'vault/reveal': {
      const result = await service.revealItem(request.id);
      return result.ok ? success(result.value) : failure(result.error);
    }

    case 'vault/create': {
      const result = await service.createItem(request.draft);
      return result.ok ? success(result.value) : failure(result.error);
    }

    case 'vault/update': {
      const result = await service.updateItem(request.item);
      return result.ok ? success(result.value) : failure(result.error);
    }

    case 'vault/delete': {
      const result = await service.deleteItem(request.id);
      return result.ok ? success() : failure(result.error);
    }

    case 'vault/changeMasterPassword': {
      const result = await service.changeMasterPassword(
        request.currentPassword,
        request.newPassword,
      );
      return result.ok ? success() : failure(result.error);
    }

    case 'vault/recoverWithCode': {
      const result = await service.recoverWithCode(request.recoveryCode);
      return result.ok ? success() : failure(result.error);
    }

    case 'vault/completeRecovery': {
      const result = await service.completeRecovery(request.newMasterPassword);
      return result.ok ? success(result.value) : failure(result.error);
    }

    case 'vault/rotateRecoveryCode': {
      const result = await service.rotateRecoveryCode();
      return result.ok ? success(result.value) : failure(result.error);
    }

    case 'vault/exportBackup': {
      const result = await service.exportBackup(request.password);
      return result.ok ? success(result.value) : failure(result.error);
    }

    case 'vault/importBackup': {
      const result = await service.importBackup(request.file, request.password);
      return result.ok ? success(result.value) : failure(result.error);
    }

    case 'clipboard/scheduleClear':
      scheduleClipboardClear();
      return success();

    case 'autofill/candidates': {
      // Sin origen verificable no hay a qué emparejar. Se devuelve la lista vacía en vez
      // de un error: para el content script «aquí no tengo nada» es la respuesta útil.
      if (pageUrl === null) return success([]);

      const result = await service.autofillCandidates(pageUrl);
      return result.ok ? success(result.value) : failure(result.error);
    }

    case 'autofill/fill': {
      if (pageUrl === null) return failure(itemNotFound(request.id));

      const result = await service.autofillCredential(request.id, pageUrl);
      return result.ok ? success(result.value) : failure(result.error);
    }
  }
}
