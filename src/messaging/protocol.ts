import { z } from 'zod';
import {
  cardItemSchema,
  loginItemSchema,
  noteItemSchema,
  vaultItemSchema,
} from '../core/model/item';
import type { ItemSummary, VaultItem } from '../core/model/item';
import type { VaultSnapshot } from '../core/vault/vaultService';
import type { VaultError } from '../core/vault/errors';
import type { BackupError, BackupFile, MergeReport } from '../core/vault/backup';

/**
 * Contrato único entre el service worker, el popup y el content script.
 *
 * Todo lo que sabe la UI sobre la bóveda pasa por aquí. Las llaves nunca cruzan esta
 * frontera: se piden datos y se devuelven datos.
 *
 * Los mensajes se **validan con zod al llegar** al service worker. No es paranoia
 * gratuita: el content script se ejecuta dentro de páginas potencialmente hostiles, y el
 * receptor de un mensaje no debe confiar en la forma de lo que recibe sólo porque venga
 * de la misma extensión.
 */

const draftFields = { id: true, createdAt: true, updatedAt: true } as const;

export const itemDraftSchema = z.discriminatedUnion('type', [
  loginItemSchema.omit(draftFields),
  noteItemSchema.omit(draftFields),
  cardItemSchema.omit(draftFields),
]);

export const requestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('vault/snapshot') }),
  z.object({ type: z.literal('vault/initialize'), masterPassword: z.string() }),
  z.object({ type: z.literal('vault/unlock'), masterPassword: z.string() }),
  z.object({ type: z.literal('vault/lock') }),
  z.object({ type: z.literal('vault/list') }),
  z.object({ type: z.literal('vault/reveal'), id: z.uuid() }),
  z.object({ type: z.literal('vault/create'), draft: itemDraftSchema }),
  z.object({ type: z.literal('vault/update'), item: vaultItemSchema }),
  z.object({ type: z.literal('vault/delete'), id: z.uuid() }),
  z.object({
    type: z.literal('vault/changeMasterPassword'),
    currentPassword: z.string(),
    newPassword: z.string(),
  }),

  // Recuperación y respaldo
  z.object({ type: z.literal('vault/recoverWithCode'), recoveryCode: z.string() }),
  z.object({ type: z.literal('vault/completeRecovery'), newMasterPassword: z.string() }),
  z.object({ type: z.literal('vault/rotateRecoveryCode') }),
  z.object({ type: z.literal('vault/exportBackup'), password: z.string() }),
  z.object({ type: z.literal('vault/importBackup'), file: z.unknown(), password: z.string() }),

  /**
   * El popup ya copió al portapapeles y pide que se programe el borrado. El secreto no
   * cruza este mensaje: el worker sólo necesita saber que hay que limpiar, no qué.
   */
  z.object({ type: z.literal('clipboard/scheduleClear') }),
]);

export type Request = z.infer<typeof requestSchema>;
export type RequestType = Request['type'];

/** Qué devuelve cada petición si tiene éxito. */
export interface ResponseMap {
  'vault/snapshot': VaultSnapshot;
  /** El código de respaldo en claro. Se muestra una vez y no vuelve a existir. */
  'vault/initialize': string;
  'vault/unlock': null;
  'vault/lock': null;
  'vault/list': readonly ItemSummary[];
  'vault/reveal': VaultItem;
  'vault/create': VaultItem;
  'vault/update': VaultItem;
  'vault/delete': null;
  'vault/changeMasterPassword': null;
  'vault/recoverWithCode': null;
  /** El código nuevo: el usado para recuperar queda invalidado. */
  'vault/completeRecovery': string;
  'vault/rotateRecoveryCode': string;
  'vault/exportBackup': BackupFile;
  'vault/importBackup': MergeReport;
  'clipboard/scheduleClear': null;
}

/**
 * Sobre el cable no viaja un `Result` sino su forma plana equivalente: las excepciones
 * no cruzan `sendMessage`, así que un fallo esperado tiene que ser un valor.
 */
export type Response<T extends RequestType> =
  | { readonly ok: true; readonly value: ResponseMap[T] }
  | { readonly ok: false; readonly error: VaultError | BackupError };

/** Extrae la petición concreta a partir de su discriminante. */
export type RequestOf<T extends RequestType> = Extract<Request, { type: T }>;
