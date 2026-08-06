import { type Result, err, ok } from '../result';
import { exportAesKey, importAesKey } from '../crypto/aes';
import { base64ToBytes, bytesToBase64 } from '../crypto/codec';
import {
  changeMasterPassword,
  createVault,
  regenerateRecoveryCode,
  resetMasterPassword,
  unlockVault,
  unlockWithRecoveryCode,
} from '../crypto/vaultKey';
import { isWellFormedRecoveryCode } from '../model/recoveryCodeFormat';
import { RECOMMENDED_COST } from '../crypto/kdf';
import { type ItemSummary, type VaultItem, toSummary } from '../model/item';
import type { Clock, IdGenerator, SessionStore } from '../ports';
import type { VaultRepository } from './vaultRepository';
import {
  type VaultError,
  alreadyInitialized,
  itemNotFound,
  locked,
  notInitialized,
  wrongRecoveryCode,
} from './errors';
import { validateMasterPassword } from './masterPassword';
import {
  type BackupError,
  type BackupFile,
  type MergeReport,
  exportBackup,
  mergeBackup,
  readBackup,
} from './backup';

/** Clave bajo la que vive la DEK en el almacenamiento de sesión (sólo memoria). */
const DEK_SESSION_KEY = 'dek';

/**
 * Marca de que se entró con el código de respaldo y falta fijar una contraseña maestra.
 * Vive en sesión y no en disco: si el navegador se cierra a mitad, la recuperación
 * simplemente se repite desde cero.
 */
const PENDING_RESET_KEY = 'pendingMasterReset';

export type VaultStatus = 'uninitialized' | 'locked' | 'unlocked';

export interface VaultSnapshot {
  readonly status: VaultStatus;
  readonly items: readonly ItemSummary[];
  /** Registros que no se pudieron descifrar. Si no es 0, la UI debe avisar. */
  readonly damagedCount: number;
  /** Se entró con el código de respaldo: hay que fijar una contraseña maestra nueva. */
  readonly pendingMasterReset: boolean;
  /** La bóveda no tiene código de respaldo configurado (caso de migración desde v1). */
  readonly missingRecoveryCode: boolean;
}

/** Un item nuevo: todo menos lo que genera el sistema. */
export type ItemDraft =
  | Omit<Extract<VaultItem, { type: 'login' }>, 'id' | 'createdAt' | 'updatedAt'>
  | Omit<Extract<VaultItem, { type: 'note' }>, 'id' | 'createdAt' | 'updatedAt'>
  | Omit<Extract<VaultItem, { type: 'card' }>, 'id' | 'createdAt' | 'updatedAt'>;

export interface VaultServiceDeps {
  readonly repository: VaultRepository;
  readonly session: SessionStore;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /**
   * Coste del KDF al **crear** la bóveda. Se inyecta por dos motivos: los tests usan
   * parámetros baratos (con los reales la suite tardaría minutos), y algún día podría
   * elegirse según la memoria del equipo. Al desbloquear no se usa: entonces mandan los
   * parámetros que trae guardados la propia bóveda.
   */
  readonly kdfCost?: { N: number; r: number; p: number };
}

/**
 * Casos de uso de la bóveda. Es el único sitio que orquesta cripto y persistencia.
 *
 * ── Sobre no cachear los items descifrados ────────────────────────────────────
 * Sería tentador mantener la bóveda descifrada en una variable del service worker. No se
 * hace, por dos razones: en MV3 esa variable desaparece cada 30 s de todos modos, y una
 * caché obliga a invalidarla en cada escritura — una fuente clásica de bugs sutiles.
 *
 * En su lugar se descifra bajo demanda. Con AES-GCM acelerado por hardware, unos cientos
 * de registros se descifran en milisegundos, y sólo ocurre al abrir el popup. El coste
 * real del desbloqueo está en scrypt, que se paga una única vez.
 */
export class VaultService {
  constructor(private readonly deps: VaultServiceDeps) {}

  // ── Estado ────────────────────────────────────────────────────────────────────

  async snapshot(): Promise<VaultSnapshot> {
    const meta = await this.deps.repository.readMeta();
    if (meta === null) {
      return {
        status: 'uninitialized',
        items: [],
        damagedCount: 0,
        pendingMasterReset: false,
        missingRecoveryCode: false,
      };
    }

    const missingRecoveryCode = meta.wrappedDek.recovery === undefined;
    const pendingMasterReset = (await this.deps.session.get(PENDING_RESET_KEY)) === true;

    const dek = await this.readDek();
    if (dek === null) {
      return {
        status: 'locked',
        items: [],
        damagedCount: 0,
        pendingMasterReset: false,
        missingRecoveryCode,
      };
    }

    const { items, damaged } = await this.deps.repository.loadAll(dek);
    return {
      status: 'unlocked',
      items: items.map(toSummary),
      damagedCount: damaged.length,
      pendingMasterReset,
      missingRecoveryCode,
    };
  }

  // ── Ciclo de vida ─────────────────────────────────────────────────────────────

  /**
   * Crea la bóveda y la deja desbloqueada.
   *
   * Devuelve el **código de respaldo en claro**. Es la única vez que existe fuera de su
   * envoltorio cifrado: quien llama debe mostrarlo al usuario y no persistirlo en
   * ningún sitio.
   */
  async initialize(masterPassword: string): Promise<Result<string, VaultError>> {
    if (await this.deps.repository.isInitialized()) return err(alreadyInitialized());

    const policy = validateMasterPassword(masterPassword);
    if (!policy.ok) return policy;

    const { meta, dek, recoveryCode } = await createVault(
      masterPassword,
      this.deps.clock.now(),
      this.deps.kdfCost ?? RECOMMENDED_COST,
    );

    await this.deps.repository.writeMeta(meta);
    await this.storeDek(dek);
    return ok(recoveryCode);
  }

  // ── Recuperación ──────────────────────────────────────────────────────────────

  /**
   * Entra con el código de respaldo tras olvidar la contraseña maestra.
   *
   * Deja la bóveda desbloqueada **pero marcada**: hasta que se llame a
   * `completeRecovery()` con una contraseña nueva, la UI debe insistir. Sin ese paso el
   * usuario seguiría sin poder entrar mañana.
   */
  async recoverWithCode(recoveryCode: string): Promise<Result<void, VaultError>> {
    const meta = await this.deps.repository.readMeta();
    if (meta === null) return err(notInitialized());

    // Se descarta por forma antes de gastar un scrypt completo: un código mal tecleado
    // no debería costar medio segundo de CPU.
    if (!isWellFormedRecoveryCode(recoveryCode)) return err(wrongRecoveryCode());

    const unlocked = await unlockWithRecoveryCode(recoveryCode, meta);
    if (!unlocked.ok) return err(wrongRecoveryCode());

    await this.storeDek(unlocked.value);
    await this.deps.session.set(PENDING_RESET_KEY, true);
    return ok(undefined);
  }

  /**
   * Cierra la recuperación: fija una contraseña maestra nueva y **rota el código**.
   *
   * El código anterior se invalida a propósito. Ya está gastado: el usuario lo tuvo que
   * sacar de donde lo guardara y pudo quedar a la vista.
   */
  async completeRecovery(newMasterPassword: string): Promise<Result<string, VaultError>> {
    const meta = await this.deps.repository.readMeta();
    if (meta === null) return err(notInitialized());

    const dek = await this.readDek();
    if (dek === null) return err(locked());

    const policy = validateMasterPassword(newMasterPassword);
    if (!policy.ok) return policy;

    const withNewMaster = await resetMasterPassword(newMasterPassword, dek, meta);
    const rotated = await regenerateRecoveryCode(dek, withNewMaster);

    await this.deps.repository.writeMeta(rotated.meta);
    await this.deps.session.set(PENDING_RESET_KEY, false);
    return ok(rotated.recoveryCode);
  }

  /**
   * Genera un código de respaldo nuevo e invalida el anterior.
   *
   * Para bóvedas migradas que aún no tienen uno, y para cuando se sospecha que el
   * código se ha filtrado.
   */
  async rotateRecoveryCode(): Promise<Result<string, VaultError>> {
    const meta = await this.deps.repository.readMeta();
    if (meta === null) return err(notInitialized());

    const dek = await this.readDek();
    if (dek === null) return err(locked());

    const rotated = await regenerateRecoveryCode(dek, meta);
    await this.deps.repository.writeMeta(rotated.meta);
    return ok(rotated.recoveryCode);
  }

  async unlock(masterPassword: string): Promise<Result<void, VaultError>> {
    const meta = await this.deps.repository.readMeta();
    if (meta === null) return err(notInitialized());

    const unlocked = await unlockVault(masterPassword, meta);
    if (!unlocked.ok) return unlocked;

    await this.storeDek(unlocked.value);
    return ok(undefined);
  }

  /**
   * Bloquea borrando el almacenamiento de sesión.
   *
   * Al vivir la DEK sólo ahí, esto la elimina de verdad: no queda copia en disco de la
   * que rehidratarla. Volver a entrar exige pagar scrypt otra vez.
   */
  async lock(): Promise<void> {
    await this.deps.session.clear();
  }

  async isUnlocked(): Promise<boolean> {
    return (await this.readDek()) !== null;
  }

  async changeMasterPassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<Result<void, VaultError>> {
    const meta = await this.deps.repository.readMeta();
    if (meta === null) return err(notInitialized());

    const policy = validateMasterPassword(newPassword);
    if (!policy.ok) return policy;

    const rewrapped = await changeMasterPassword(currentPassword, newPassword, meta);
    if (!rewrapped.ok) return rewrapped;

    // Los items no se tocan: siguen cifrados con la misma DEK, sólo cambió su envoltorio.
    await this.deps.repository.writeMeta(rewrapped.value);
    return ok(undefined);
  }

  // ── Items ─────────────────────────────────────────────────────────────────────

  async listItems(): Promise<Result<readonly ItemSummary[], VaultError>> {
    const dek = await this.readDek();
    if (dek === null) return err(locked());

    const { items } = await this.deps.repository.loadAll(dek);
    return ok(items.map(toSummary));
  }

  /** Devuelve el item completo, con secretos. Sólo tras una acción explícita del usuario. */
  async revealItem(id: string): Promise<Result<VaultItem, VaultError>> {
    const dek = await this.readDek();
    if (dek === null) return err(locked());

    const item = await this.deps.repository.readItem(dek, id);
    return item.ok ? item : err(itemNotFound(id));
  }

  async createItem(draft: ItemDraft): Promise<Result<VaultItem, VaultError>> {
    const dek = await this.readDek();
    if (dek === null) return err(locked());

    const now = this.deps.clock.now();
    const item = { ...draft, id: this.deps.ids.newId(), createdAt: now, updatedAt: now };

    await this.deps.repository.saveItem(dek, item);
    return ok(item);
  }

  async updateItem(item: VaultItem): Promise<Result<VaultItem, VaultError>> {
    const dek = await this.readDek();
    if (dek === null) return err(locked());

    const existing = await this.deps.repository.readItem(dek, item.id);
    if (!existing.ok) return err(itemNotFound(item.id));

    // `createdAt` es del sistema: se conserva el original aunque el llamador mande otro.
    const updated = {
      ...item,
      createdAt: existing.value.createdAt,
      updatedAt: this.deps.clock.now(),
    };

    await this.deps.repository.saveItem(dek, updated);
    return ok(updated);
  }

  async deleteItem(id: string): Promise<Result<void, VaultError>> {
    if (!(await this.isUnlocked())) return err(locked());

    await this.deps.repository.deleteItem(id);
    return ok(undefined);
  }

  // ── Respaldo del contenido ────────────────────────────────────────────────────

  /**
   * Exporta la bóveda entera a un archivo cifrado con su propia contraseña.
   *
   * Complementa al código de respaldo: aquel devuelve el acceso, éste devuelve los
   * datos. Ante un disco muerto, sólo este archivo salva el contenido.
   */
  async exportBackup(password: string): Promise<Result<BackupFile, VaultError>> {
    const dek = await this.readDek();
    if (dek === null) return err(locked());

    const { items } = await this.deps.repository.loadAll(dek);
    return ok(await exportBackup(items, password, this.deps.clock.now(), this.deps.kdfCost));
  }

  /**
   * Importa un respaldo fusionándolo con lo que ya existe.
   *
   * No reemplaza la bóveda: cruza por id y conserva la versión más reciente de cada
   * item, de modo que reimportar el mismo archivo no duplica ni pisa nada.
   */
  async importBackup(
    raw: unknown,
    password: string,
  ): Promise<Result<MergeReport, VaultError | BackupError>> {
    const dek = await this.readDek();
    if (dek === null) return err(locked());

    const backup = await readBackup(raw, password);
    if (!backup.ok) return backup;

    const { items: current } = await this.deps.repository.loadAll(dek);
    const { items, report } = mergeBackup(current, backup.value);

    // Sólo se reescribe lo que realmente cambió, para no reciclar el IV de registros
    // intactos ni castigar el almacenamiento sin motivo.
    const currentById = new Map(current.map((item) => [item.id, item]));
    for (const item of items) {
      if (currentById.get(item.id)?.updatedAt !== item.updatedAt) {
        await this.deps.repository.saveItem(dek, item);
      }
    }

    return ok(report);
  }

  // ── DEK en almacenamiento de sesión ───────────────────────────────────────────

  private async storeDek(dek: CryptoKey): Promise<void> {
    const raw = await exportAesKey(dek);
    await this.deps.session.set(DEK_SESSION_KEY, bytesToBase64(raw));
  }

  /**
   * Recupera la DEK de la sesión, o `null` si la bóveda está bloqueada.
   *
   * Este método es el que hace que sobrevivir a la muerte del service worker sea
   * transparente: al revivir, la primera operación vuelve a leer la llave de aquí sin
   * que el usuario note nada.
   */
  private async readDek(): Promise<CryptoKey | null> {
    const stored = await this.deps.session.get(DEK_SESSION_KEY);
    if (typeof stored !== 'string') return null;

    try {
      return await importAesKey(base64ToBytes(stored));
    } catch {
      // Sesión corrupta: se trata como bloqueada en vez de propagar el fallo. El usuario
      // sólo tiene que volver a introducir la contraseña maestra.
      return null;
    }
  }
}
