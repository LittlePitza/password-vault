import { z } from 'zod';
import { type Result, err, ok } from '../result';
import { type CryptoError, corruptData, wrongPassword } from '../crypto/errors';
import { decryptBytes, encryptBytes, importAesKey } from '../crypto/aes';
import { bytesToUtf8, utf8ToBytes } from '../crypto/codec';
import { createKdfParams, deriveKeyEncryptionKey } from '../crypto/kdf';
import { type VaultItem, vaultItemSchema } from '../model/item';
import { clean } from '@noble/hashes/utils.js';

/**
 * Respaldo del **contenido** de la bóveda a un archivo cifrado.
 *
 * Es complementario al código de respaldo, no una alternativa: el código recupera el
 * acceso, este archivo recupera los datos. Si se muere el disco, el código solo no
 * sirve de nada porque ya no hay nada que abrir.
 *
 * ── Por qué contraseña propia y no la maestra ─────────────────────────────────
 * El archivo es autocontenido: lleva su propio salt y sus propios parámetros de KDF, y
 * no depende de ninguna cabecera de bóveda. Así sigue siendo legible aunque después se
 * cambie la contraseña maestra, se regenere el código de respaldo o se reinstale todo
 * desde cero. A cambio, es una contraseña más que recordar — por eso la UI sugiere
 * reutilizar la maestra, pero no lo impone.
 *
 * ── Advertencia que la UI debe repetir ────────────────────────────────────────
 * Este archivo ES la bóveda. Guardarlo en una carpeta sincronizada (OneDrive, Drive)
 * sube una copia completa a la nube: exactamente lo que este proyecto evita. Su sitio
 * es un disco externo o una memoria guardada bajo llave.
 */

export const BACKUP_FORMAT = 'password-vault-backup';
export const BACKUP_VERSION = 1;

const backupFileSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().positive(),
  createdAt: z.number().int().nonnegative(),
  itemCount: z.number().int().nonnegative(),
  kdf: z.object({
    algo: z.literal('scrypt'),
    N: z.number().int().positive(),
    r: z.number().int().positive(),
    p: z.number().int().positive(),
    salt: z.string(),
  }),
  payload: z.object({ iv: z.string(), ct: z.string() }),
});

export type BackupFile = z.infer<typeof backupFileSchema>;

/**
 * `itemCount` va en claro a propósito: permite comprobar de un vistazo que el archivo
 * tiene lo que se espera antes de teclear la contraseña. No revela ningún secreto.
 */
export async function exportBackup(
  items: readonly VaultItem[],
  password: string,
  now: number,
  cost?: { N: number; r: number; p: number },
): Promise<BackupFile> {
  const kdf = createKdfParams(cost);
  const kek = await deriveKeyEncryptionKey(password, kdf);

  try {
    const payload = await encryptBytes(await importAesKey(kek), utf8ToBytes(JSON.stringify(items)));
    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      createdAt: now,
      itemCount: items.length,
      kdf,
      payload,
    };
  } finally {
    clean(kek);
  }
}

export type BackupError =
  | CryptoError
  | { readonly kind: 'not-a-backup'; readonly detail: string }
  | { readonly kind: 'unsupported-backup-version'; readonly found: number };

/** Descifra y valida un archivo de respaldo. No toca la bóveda: sólo devuelve los items. */
export async function readBackup(
  raw: unknown,
  password: string,
): Promise<Result<VaultItem[], BackupError>> {
  const file = backupFileSchema.safeParse(raw);
  if (!file.success) {
    return err({ kind: 'not-a-backup', detail: 'El archivo no tiene el formato esperado.' });
  }

  if (file.data.version > BACKUP_VERSION) {
    return err({ kind: 'unsupported-backup-version', found: file.data.version });
  }

  const kek = await deriveKeyEncryptionKey(password, file.data.kdf);
  let plaintext: Result<Uint8Array, CryptoError>;
  try {
    plaintext = await decryptBytes(await importAesKey(kek), file.data.payload);
  } finally {
    clean(kek);
  }

  if (!plaintext.ok) return err(wrongPassword());

  let parsed: unknown;
  try {
    parsed = JSON.parse(bytesToUtf8(plaintext.value));
  } catch {
    return err(corruptData('el respaldo descifrado no es JSON válido'));
  }

  // Cada item se valida igual que al leerlo de la bóveda: descifrar bien no garantiza
  // que la forma sea correcta, y un respaldo puede venir de otra versión del esquema.
  const items = z.array(vaultItemSchema).safeParse(parsed);
  if (!items.success) {
    return err(
      corruptData(
        `el respaldo contiene registros inválidos: ${items.error.issues[0]?.message ?? 'forma desconocida'}`,
      ),
    );
  }

  return ok(items.data);
}

export interface MergeReport {
  readonly added: number;
  readonly updated: number;
  /** Presentes en el respaldo pero más antiguos que lo que ya hay en la bóveda. */
  readonly skipped: number;
}

export interface MergeResult {
  readonly items: VaultItem[];
  readonly report: MergeReport;
}

/**
 * Fusiona un respaldo con la bóveda actual.
 *
 * Se cruza por `id` y gana el `updatedAt` más reciente, en vez de reemplazarlo todo.
 * Eso hace la importación **idempotente**: reimportar el mismo archivo dos veces no
 * duplica nada ni pisa cambios más nuevos hechos entretanto.
 */
export function mergeBackup(
  current: readonly VaultItem[],
  imported: readonly VaultItem[],
): MergeResult {
  const merged = new Map(current.map((item) => [item.id, item]));
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of imported) {
    const existing = merged.get(item.id);
    if (existing === undefined) {
      merged.set(item.id, item);
      added++;
    } else if (item.updatedAt > existing.updatedAt) {
      merged.set(item.id, item);
      updated++;
    } else {
      skipped++;
    }
  }

  return {
    items: [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt),
    report: { added, updated, skipped },
  };
}

export function describeBackupError(error: BackupError): string {
  switch (error.kind) {
    case 'not-a-backup':
      return error.detail;
    case 'unsupported-backup-version':
      return `Este respaldo usa el formato v${String(error.found)}, más nuevo que el que entiende esta versión de la extensión.`;
    case 'wrong-password':
      return 'La contraseña no abre este archivo de respaldo.';
    case 'corrupt-data':
      return 'El archivo de respaldo está dañado.';
    case 'unsupported-version':
      return 'Formato de respaldo no soportado.';
  }
}
