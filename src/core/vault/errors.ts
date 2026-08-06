import { type CryptoError, describeCryptoError } from '../crypto/errors';
import { type BackupError, describeBackupError } from './backup';

/**
 * Errores de la bóveda: los criptográficos más los de flujo de la aplicación.
 *
 * Se mantiene como unión discriminada plana en vez de una jerarquía de clases porque
 * cruza la frontera de mensajes hacia el popup, y ahí sólo sobrevive lo serializable.
 */
export type VaultError =
  | CryptoError
  | { readonly kind: 'locked' }
  | { readonly kind: 'not-initialized' }
  | { readonly kind: 'already-initialized' }
  | { readonly kind: 'item-not-found'; readonly id: string }
  | { readonly kind: 'weak-master-password'; readonly reason: string }
  | { readonly kind: 'wrong-recovery-code' }
  /**
   * Fallo que ningún caso de uso previó: cuota de almacenamiento agotada, el canal de
   * mensajes caído, una excepción inesperada del navegador.
   *
   * Existe para que un fallo así siga siendo un **valor** y no una promesa rechazada. Sin
   * esta variante, una excepción en el service worker deja al popup esperando una
   * respuesta que no llega nunca — y un popup congelado es peor que un mensaje de error.
   *
   * `detail` es para diagnóstico y no se muestra: una excepción arbitraria podría
   * arrastrar contenido de la bóveda en su mensaje.
   */
  | { readonly kind: 'unexpected'; readonly detail: string };

export const locked = (): VaultError => ({ kind: 'locked' });
export const notInitialized = (): VaultError => ({ kind: 'not-initialized' });
export const alreadyInitialized = (): VaultError => ({ kind: 'already-initialized' });
export const itemNotFound = (id: string): VaultError => ({ kind: 'item-not-found', id });
export const weakMasterPassword = (reason: string): VaultError => ({
  kind: 'weak-master-password',
  reason,
});
export const wrongRecoveryCode = (): VaultError => ({ kind: 'wrong-recovery-code' });

/**
 * Envuelve lo que se haya capturado en un `catch`.
 *
 * Acepta `unknown` porque en JavaScript se puede lanzar cualquier cosa, no sólo `Error`.
 * El texto se trunca: sólo sirve para diagnosticar en la consola.
 */
export const unexpected = (cause: unknown): VaultError => ({
  kind: 'unexpected',
  detail: (cause instanceof Error ? cause.message : String(cause)).slice(0, 200),
});

/**
 * Traduce cualquier error que pueda llegar por el canal de mensajes.
 *
 * Existe porque las respuestas del service worker pueden traer un `VaultError` o un
 * `BackupError`, y la UI no debería tener que distinguirlos ni recurrir a un cast para
 * mostrar un texto.
 */
export function describeAnyError(error: VaultError | BackupError): string {
  // Se comprueban primero las variantes exclusivas del respaldo; el resto de tipos son
  // comunes a ambas uniones y los cubre `describeVaultError`.
  if (error.kind === 'not-a-backup' || error.kind === 'unsupported-backup-version') {
    return describeBackupError(error);
  }
  return describeVaultError(error);
}

/** Mensaje para la UI. Nunca incluye material criptográfico ni contenido de la bóveda. */
export function describeVaultError(error: VaultError): string {
  switch (error.kind) {
    case 'locked':
      return 'La bóveda está bloqueada.';
    case 'not-initialized':
      return 'Todavía no has creado una bóveda.';
    case 'already-initialized':
      return 'Ya existe una bóveda en este dispositivo.';
    case 'item-not-found':
      return 'Ese elemento ya no existe.';
    case 'weak-master-password':
      return error.reason;
    case 'wrong-recovery-code':
      return 'Ese código de respaldo no es válido para esta bóveda.';
    case 'unexpected':
      // Genérico a propósito: `detail` puede traer el mensaje de una excepción
      // cualquiera, y eso no se enseña. Queda en la consola del service worker.
      return 'Algo falló dentro de la extensión y la operación no se completó. Vuelve a intentarlo.';
    case 'wrong-password':
    case 'corrupt-data':
    case 'unsupported-version':
      return describeCryptoError(error);
  }
}
