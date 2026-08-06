import { type Result, err } from '../result';
import { type CryptoError, corruptData } from '../crypto/errors';
import type { Ciphertext } from '../crypto/aes';
import { type VaultMeta, migrateMeta } from '../crypto/vaultKey';
import type { VaultItem } from '../model/item';
import type { VaultStorage } from '../ports';
import { decryptItem, encryptItem } from './itemCodec';

/**
 * Persistencia de la bóveda. Traduce entre items en claro y el almacenamiento cifrado.
 *
 * Depende del puerto `VaultStorage`, no de `chrome.storage`, así que se prueba entero
 * con un doble en memoria.
 */

const META_KEY = 'vault:meta';
const ITEM_PREFIX = 'vault:item:';

const itemKey = (id: string): string => `${ITEM_PREFIX}${id}`;

/** Un item que no se pudo descifrar. Se reporta en vez de silenciarse. */
export interface DamagedItem {
  readonly id: string;
  readonly error: CryptoError;
}

export interface LoadResult {
  readonly items: VaultItem[];
  /** Registros ilegibles. Si esto no está vacío, la UI debe avisar al usuario. */
  readonly damaged: DamagedItem[];
}

export class VaultRepository {
  constructor(private readonly storage: VaultStorage) {}

  // ── Metadatos (cabecera de la bóveda, sin secretos en claro) ──────────────────

  /**
   * Lee la cabecera aplicando la migración de formato.
   *
   * Una bóveda creada por una versión anterior de la extensión se normaliza aquí a la
   * forma actual, de modo que el resto del código nunca ve formatos antiguos.
   */
  async readMeta(): Promise<VaultMeta | null> {
    const raw = await this.storage.get(META_KEY);
    return raw == null ? null : migrateMeta(raw);
  }

  async writeMeta(meta: VaultMeta): Promise<void> {
    await this.storage.set(META_KEY, meta);
  }

  async isInitialized(): Promise<boolean> {
    return (await this.readMeta()) !== null;
  }

  // ── Items ─────────────────────────────────────────────────────────────────────

  async saveItem(dek: CryptoKey, item: VaultItem): Promise<void> {
    await this.storage.set(itemKey(item.id), await encryptItem(dek, item));
  }

  async readItem(dek: CryptoKey, id: string): Promise<Result<VaultItem, CryptoError>> {
    const raw = await this.storage.get(itemKey(id));
    if (raw == null) return err(corruptData(`no existe el item ${id}`));
    return decryptItem(dek, raw as Ciphertext);
  }

  async deleteItem(id: string): Promise<void> {
    await this.storage.remove(itemKey(id));
  }

  /**
   * Descifra la bóveda entera.
   *
   * Se llama al desbloquear y al revivir el service worker. Un registro dañado no aborta
   * la carga: se aparta en `damaged` para que el resto de la bóveda siga siendo usable —
   * perder una contraseña es malo, perder las doscientas por un byte corrupto sería peor.
   */
  async loadAll(dek: CryptoKey): Promise<LoadResult> {
    const keys = await this.storage.keysWithPrefix(ITEM_PREFIX);
    const stored = await this.storage.getMany(keys);

    const items: VaultItem[] = [];
    const damaged: DamagedItem[] = [];

    for (const key of keys) {
      const id = key.slice(ITEM_PREFIX.length);
      const raw = stored[key];
      if (raw == null) {
        damaged.push({ id, error: corruptData('registro vacío') });
        continue;
      }

      const decrypted = await decryptItem(dek, raw as Ciphertext);
      if (decrypted.ok) {
        items.push(decrypted.value);
      } else {
        damaged.push({ id, error: decrypted.error });
      }
    }

    items.sort((a, b) => b.updatedAt - a.updatedAt);
    return { items, damaged };
  }
}

/** Expuesto para la comprobación manual del plan: inspeccionar storage en DevTools. */
export const STORAGE_KEYS = { META_KEY, ITEM_PREFIX } as const;
