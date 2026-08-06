import type { Clock, IdGenerator, SessionStore, VaultStorage } from '@/src/core/ports';

/**
 * Implementaciones en memoria de los puertos.
 *
 * Que estos dobles quepan en 40 líneas es la prueba de que la frontera de `ports.ts`
 * está bien puesta: el núcleo no pide nada del navegador que no sea un mapa clave-valor.
 */

export class FakeStorage implements VaultStorage, SessionStore {
  private readonly data = new Map<string, unknown>();

  get(key: string): Promise<unknown> {
    return Promise.resolve(this.data.get(key) ?? null);
  }

  getMany(keys: readonly string[]): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      const value = this.data.get(key);
      if (value !== undefined) result[key] = value;
    }
    return Promise.resolve(result);
  }

  set(key: string, value: unknown): Promise<void> {
    // Se serializa y re-parsea para imitar chrome.storage, que hace structured clone:
    // así un test no puede pasar por accidente compartiendo una referencia en memoria.
    this.data.set(key, JSON.parse(JSON.stringify(value)));
    return Promise.resolve();
  }

  remove(key: string): Promise<void> {
    this.data.delete(key);
    return Promise.resolve();
  }

  keysWithPrefix(prefix: string): Promise<string[]> {
    return Promise.resolve([...this.data.keys()].filter((k) => k.startsWith(prefix)).sort());
  }

  clear(): Promise<void> {
    this.data.clear();
    return Promise.resolve();
  }

  /** Ayuda de test: inspecciona el disco simulado tal cual está guardado. */
  raw(key: string): unknown {
    return this.data.get(key);
  }

  /** Ayuda de test: todo el contenido serializado, para buscar fugas en claro. */
  dump(): string {
    return JSON.stringify([...this.data.entries()]);
  }
}

export class FakeClock implements Clock {
  constructor(private current = 1_700_000_000_000) {}

  now(): number {
    return this.current;
  }

  advance(ms: number): void {
    this.current += ms;
  }
}

export class SequentialIds implements IdGenerator {
  private counter = 0;

  newId(): string {
    this.counter++;
    // UUID v4 sintético pero válido para el esquema zod.
    const suffix = this.counter.toString(16).padStart(12, '0');
    return `00000000-0000-4000-8000-${suffix}`;
  }
}

/**
 * Parámetros de scrypt deliberadamente débiles, sólo para tests.
 *
 * Los reales (N=2^17) tardan ~1 s por derivación a propósito; con decenas de tests eso
 * serían minutos. La seguridad se verifica con los parámetros reales en un único test
 * de calibración, no en cada caso.
 */
export const TEST_COST = { N: 2 ** 8, r: 8, p: 1 } as const;
