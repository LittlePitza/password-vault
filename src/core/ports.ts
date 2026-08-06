/**
 * Puertos: las interfaces que el núcleo necesita del mundo exterior.
 *
 * `src/core/` no importa `chrome.*` en ningún punto — la regla de ESLint lo impide.
 * En su lugar declara aquí lo que necesita, y `src/platform/` lo implementa contra las
 * APIs del navegador. Los tests inyectan implementaciones en memoria.
 *
 * Consecuencia práctica: toda la criptografía y la lógica de bóveda se prueban en Node,
 * sin navegador; y añadir Firefox algún día sería escribir otro adaptador sin tocar nada
 * de esto.
 */

/**
 * Almacenamiento persistente en disco. Corresponde a `chrome.storage.local`.
 * Todo lo que se guarda aquí ya va cifrado por nosotros — el navegador no lo cifra.
 */
export interface VaultStorage {
  get(key: string): Promise<unknown>;
  getMany(keys: readonly string[]): Promise<Record<string, unknown>>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  /** Todas las claves con el prefijo dado. */
  keysWithPrefix(prefix: string): Promise<string[]>;
}

/**
 * Almacenamiento **sólo en memoria**, que sobrevive al reinicio del service worker pero
 * nunca toca el disco. Corresponde a `chrome.storage.session`.
 *
 * Es la pieza que resuelve el problema central de MV3: el service worker muere a los
 * ~30 s de inactividad y se lleva por delante toda variable global, incluida la llave.
 * Guardando aquí la DEK, al revivir se recupera sin volver a pedir la contraseña maestra
 * ni pagar otra vez el coste de scrypt.
 */
export interface SessionStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  clear(): Promise<void>;
}

/** Inyectable para que los tests controlen el tiempo en vez de depender del reloj real. */
export interface Clock {
  now(): number;
}

export const systemClock: Clock = {
  now: () => Date.now(),
};

/** Generador de identificadores. Inyectable para tests deterministas. */
export interface IdGenerator {
  newId(): string;
}

export const cryptoIdGenerator: IdGenerator = {
  newId: () => crypto.randomUUID(),
};
