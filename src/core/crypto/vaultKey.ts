import { clean } from '@noble/hashes/utils.js';
import { type Result, err, ok } from '../result';
import { type CryptoError, unsupportedVersion, wrongPassword } from './errors';
import {
  type Ciphertext,
  decryptBytes,
  encryptBytes,
  exportAesKey,
  generateAesKey,
  importAesKey,
} from './aes';
import { type KdfParams, createKdfParams, deriveKeyEncryptionKey } from './kdf';
import { generateRecoveryCode } from './recoveryCode';
import { normalizeRecoveryCode } from '../model/recoveryCodeFormat';

/**
 * Jerarquía de llaves con **múltiples destinatarios**.
 *
 *   Contraseña maestra ──scrypt──▶ KEK-maestra ──┐
 *                                                ├──AES-GCM──▶ DEK ──▶ cada item
 *   Código de respaldo ──scrypt──▶ KEK-respaldo ─┘
 *
 * La DEK es una sola; lo que hay son dos envoltorios independientes de la misma llave.
 * Cualquiera de los dos la abre. Es el mismo patrón multi-destinatario de PGP o `age`.
 *
 * Consecuencias que importan:
 *  · Cambiar la contraseña maestra no invalida el código de respaldo, y viceversa.
 *  · Los items nunca se re-cifran: sólo cambian 32 bytes de envoltorio.
 *  · Añadir mañana un tercer destinatario (escrow corporativo con clave pública de la
 *    empresa) es añadir una entrada más a `wrappedDek`, sin tocar los datos.
 */

/**
 * v1: `wrappedDek` era un único Ciphertext.
 * v2: `wrappedDek` es `{ master, recovery? }` y aparece `recoveryKdf`.
 */
export const VAULT_FORMAT_VERSION = 2;

export interface WrappedKeys {
  readonly master: Ciphertext;
  /** Ausente sólo en bóvedas migradas de v1 que aún no han generado su código. */
  readonly recovery?: Ciphertext;
}

export interface VaultMeta {
  readonly version: number;
  readonly kdf: KdfParams;
  /** Salt propio para el código de respaldo: nunca comparte derivación con la maestra. */
  readonly recoveryKdf?: KdfParams;
  readonly wrappedDek: WrappedKeys;
  readonly createdAt: number;
}

export interface CreatedVault {
  readonly meta: VaultMeta;
  readonly dek: CryptoKey;
  /**
   * El código en claro. Se devuelve **una sola vez**: no se guarda en ningún sitio, sólo
   * su envoltorio. Si el usuario no lo apunta ahora, hay que regenerarlo.
   */
  readonly recoveryCode: string;
}

interface Cost {
  N: number;
  r: number;
  p: number;
}

export async function createVault(
  masterPassword: string,
  now: number,
  cost?: Cost,
): Promise<CreatedVault> {
  const dek = await generateAesKey();
  const recoveryCode = generateRecoveryCode();

  const kdf = createKdfParams(cost);
  const recoveryKdf = createKdfParams(cost);

  const master = await wrapWith(masterPassword, kdf, dek);
  const recovery = await wrapWith(normalizeRecoveryCode(recoveryCode), recoveryKdf, dek);

  return {
    meta: {
      version: VAULT_FORMAT_VERSION,
      kdf,
      recoveryKdf,
      wrappedDek: { master, recovery },
      createdAt: now,
    },
    dek,
    recoveryCode,
  };
}

export async function unlockVault(
  masterPassword: string,
  meta: VaultMeta,
): Promise<Result<CryptoKey, CryptoError>> {
  if (meta.version > VAULT_FORMAT_VERSION) {
    return err(unsupportedVersion(meta.version, VAULT_FORMAT_VERSION));
  }
  return unwrapWith(masterPassword, meta.kdf, meta.wrappedDek.master);
}

/**
 * Desbloquea con el código de respaldo.
 *
 * Quien llega aquí ha olvidado su contraseña maestra, así que el flujo de la aplicación
 * debe obligarle a fijar una nueva inmediatamente después (ver `VaultService`).
 */
export async function unlockWithRecoveryCode(
  recoveryCode: string,
  meta: VaultMeta,
): Promise<Result<CryptoKey, CryptoError>> {
  if (meta.version > VAULT_FORMAT_VERSION) {
    return err(unsupportedVersion(meta.version, VAULT_FORMAT_VERSION));
  }

  const { recovery } = meta.wrappedDek;
  if (recovery === undefined || meta.recoveryKdf === undefined) {
    // Bóveda sin código configurado. Se responde igual que ante un código incorrecto:
    // el estado interno de una bóveda ajena no es información que debamos revelar.
    return err(wrongPassword());
  }

  return unwrapWith(normalizeRecoveryCode(recoveryCode), meta.recoveryKdf, recovery);
}

/** Cambia la maestra re-envolviendo sólo su entrada. El código de respaldo sigue válido. */
export async function changeMasterPassword(
  currentPassword: string,
  newPassword: string,
  meta: VaultMeta,
): Promise<Result<VaultMeta, CryptoError>> {
  const unlocked = await unlockVault(currentPassword, meta);
  if (!unlocked.ok) return unlocked;

  return ok(await rewrapMaster(newPassword, unlocked.value, meta));
}

/**
 * Fija una contraseña maestra nueva a partir de una DEK ya desbloqueada.
 *
 * Se usa tras entrar con el código de respaldo, donde por definición no se conoce la
 * contraseña anterior y por tanto `changeMasterPassword` no sirve.
 */
export async function resetMasterPassword(
  newPassword: string,
  dek: CryptoKey,
  meta: VaultMeta,
): Promise<VaultMeta> {
  return rewrapMaster(newPassword, dek, meta);
}

/**
 * Genera un código de respaldo nuevo e invalida el anterior.
 *
 * Necesario tras usarlo para recuperar (ya está "gastado": el usuario lo tuvo escrito y
 * quizá lo dejó a la vista) y cuando se sospecha que se ha filtrado.
 */
export async function regenerateRecoveryCode(
  dek: CryptoKey,
  meta: VaultMeta,
): Promise<{ meta: VaultMeta; recoveryCode: string }> {
  const recoveryCode = generateRecoveryCode();
  const recoveryKdf = createKdfParams({ N: meta.kdf.N, r: meta.kdf.r, p: meta.kdf.p });
  const recovery = await wrapWith(normalizeRecoveryCode(recoveryCode), recoveryKdf, dek);

  return {
    meta: {
      ...meta,
      version: VAULT_FORMAT_VERSION,
      recoveryKdf,
      wrappedDek: { ...meta.wrappedDek, recovery },
    },
    recoveryCode,
  };
}

/**
 * Lleva una cabecera de v1 a la forma de v2.
 *
 * En v1 `wrappedDek` era directamente el Ciphertext de la maestra. Se reinterpreta como
 * la entrada `master` y la bóveda queda sin código de respaldo hasta que el usuario
 * genere uno — la UI se lo pedirá. No hay que re-cifrar ningún item.
 */
export function migrateMeta(raw: unknown): VaultMeta | null {
  if (raw === null || typeof raw !== 'object') return null;

  const { wrappedDek, kdf, createdAt } = raw as Partial<{
    wrappedDek: unknown;
    kdf: KdfParams;
    createdAt: number;
  }>;

  if (wrappedDek === null || typeof wrappedDek !== 'object') return null;

  // La forma de v1 se reconoce porque el envoltorio lleva `iv` en la raíz.
  if ('iv' in wrappedDek) {
    // Sin parámetros de KDF no hay forma de derivar la llave: la cabecera es inservible
    // y decirlo aquí es mejor que arrastrar un `undefined` hasta el desbloqueo.
    if (kdf === undefined) return null;

    return {
      version: VAULT_FORMAT_VERSION,
      kdf,
      wrappedDek: { master: wrappedDek as Ciphertext },
      createdAt: typeof createdAt === 'number' ? createdAt : 0,
    };
  }

  return raw as VaultMeta;
}

// ── Interno ─────────────────────────────────────────────────────────────────────

async function rewrapMaster(
  newPassword: string,
  dek: CryptoKey,
  meta: VaultMeta,
): Promise<VaultMeta> {
  // Salt nuevo: la contraseña anterior y la nueva no deben compartir derivación.
  const kdf = createKdfParams({ N: meta.kdf.N, r: meta.kdf.r, p: meta.kdf.p });
  const master = await wrapWith(newPassword, kdf, dek);

  return {
    ...meta,
    version: VAULT_FORMAT_VERSION,
    kdf,
    wrappedDek: { ...meta.wrappedDek, master },
  };
}

async function wrapWith(secret: string, kdf: KdfParams, dek: CryptoKey): Promise<Ciphertext> {
  const kek = await deriveKeyEncryptionKey(secret, kdf);
  const rawDek = await exportAesKey(dek);
  try {
    return await encryptBytes(await importAesKey(kek), rawDek);
  } finally {
    // La KEK y la DEK en claro se sobrescriben con ceros en cuanto dejan de hacer falta.
    clean(kek);
    clean(rawDek);
  }
}

async function unwrapWith(
  secret: string,
  kdf: KdfParams,
  wrapped: Ciphertext,
): Promise<Result<CryptoKey, CryptoError>> {
  const kek = await deriveKeyEncryptionKey(secret, kdf);
  try {
    const rawDek = await decryptBytes(await importAesKey(kek), wrapped);
    // Se reetiqueta como 'wrong-password': no debe poder distinguirse un secreto
    // incorrecto de un dato corrupto.
    if (!rawDek.ok) return err(wrongPassword());

    try {
      return ok(await importAesKey(rawDek.value));
    } finally {
      clean(rawDek.value);
    }
  } finally {
    clean(kek);
  }
}
