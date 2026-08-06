import { browser } from 'wxt/browser';
import type { VaultStorage } from '../core/ports';

/**
 * Adaptador de `VaultStorage` sobre `browser.storage.local`.
 *
 * Todo lo que pasa por aquí ya viene cifrado desde el núcleo. El navegador **no** cifra
 * `storage.local`: su contenido es un archivo legible dentro del perfil. Por eso la
 * bóveda se cifra antes de llegar a esta capa y no al revés.
 *
 * Es el único punto del proyecto, junto con sus hermanos de `platform/`, donde se toca
 * la API del navegador. La regla de ESLint sobre `src/core/**` lo garantiza.
 */
export class BrowserVaultStorage implements VaultStorage {
  async get(key: string): Promise<unknown> {
    const result = await browser.storage.local.get(key);
    return result[key] ?? null;
  }

  async getMany(keys: readonly string[]): Promise<Record<string, unknown>> {
    if (keys.length === 0) return {};
    return browser.storage.local.get([...keys]);
  }

  async set(key: string, value: unknown): Promise<void> {
    await browser.storage.local.set({ [key]: value });
  }

  async remove(key: string): Promise<void> {
    await browser.storage.local.remove(key);
  }

  async keysWithPrefix(prefix: string): Promise<string[]> {
    // `get(null)` trae la bóveda entera. Con el volumen de un gestor personal (cientos
    // de registros, no millones) es irrelevante, y evita mantener un índice aparte que
    // podría desincronizarse del contenido real.
    const all = await browser.storage.local.get(null);
    return Object.keys(all)
      .filter((key) => key.startsWith(prefix))
      .sort();
  }
}
