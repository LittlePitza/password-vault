import { scryptAsync } from '@noble/hashes/scrypt.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { base64ToBytes, bytesToBase64, utf8ToBytes } from './codec';

/**
 * Derivación de la llave a partir de la contraseña maestra.
 *
 * ── Por qué scrypt y no Argon2id ──────────────────────────────────────────────
 * Argon2id es el algoritmo más fuerte sobre el papel, pero ninguno de sus dos caminos
 * servía aquí:
 *
 *   · Argon2id en JS puro (@noble/hashes/argon2) NO está auditado — quedó fuera del
 *     audit de Cure53 — y sus propios autores advierten que "Argon2 no puede ser rápido
 *     en JS porque no existe un Uint64Array rápido". Ser ~5x más lento que código nativo
 *     le regala esa ventaja al atacante, que sí usa código nativo.
 *   · Argon2id vía WASM (hash-wasm) daría velocidad nativa, pero obliga a relajar el CSP
 *     de la extensión con 'wasm-unsafe-eval' y esa librería no recibe cambios desde 2024.
 *
 * scrypt de @noble/hashes sí está auditado, es memory-hard, y al ser JS puro deja el CSP
 * en su forma más estricta (`script-src 'self'`), sin binarios en el paquete.
 *
 * ── Sobre los parámetros ──────────────────────────────────────────────────────
 * Se guardan en la cabecera de la bóveda, no aquí, para poder endurecerlos en el futuro
 * sin invalidar bóvedas existentes: al desbloquear se usan los que trae la bóveda.
 */

/** Único algoritmo soportado hoy. Es un campo para poder migrar sin romper bóvedas. */
export type KdfAlgorithm = 'scrypt';

export interface KdfParams {
  readonly algo: KdfAlgorithm;
  /** Factor de coste CPU/memoria. Potencia de 2. Memoria usada = 128 · N · r bytes. */
  readonly N: number;
  /** Tamaño de bloque. */
  readonly r: number;
  /** Paralelismo. */
  readonly p: number;
  /** Salt aleatorio en base64, único por bóveda. */
  readonly salt: string;
}

/**
 * Parámetros calibrados sobre la máquina objetivo (Node 24, agosto 2026):
 *
 *   N=2^17 r=8 p=1  →  282 ms   (128 MiB)   ← mínimo OWASP
 *   N=2^17 r=8 p=2  →  542 ms   (128 MiB)   ← elegido
 *   N=2^17 r=8 p=3  →  1047 ms  (128 MiB)
 *   N=2^18 r=8 p=1  →  725 ms   (256 MiB)
 *
 * Se sube el coste por `p` y no por `N`. Ambos encarecen el ataque, pero `N` multiplica
 * la memoria y `p` sólo el tiempo de CPU: pedir 256 MiB dentro de un service worker de
 * MV3 arriesga que el navegador lo mate durante el desbloqueo, y un gestor que a veces
 * no abre es peor que uno un poco menos costoso de atacar.
 *
 * Resultado: el doble de coste que el mínimo OWASP, con su misma huella de memoria.
 */
export const RECOMMENDED_COST = { N: 2 ** 17, r: 8, p: 2 } as const;

/** Escalón para equipos con poca memoria: ≈365 ms y 64 MiB. Sigue siendo defendible. */
export const MODERATE_COST = { N: 2 ** 16, r: 8, p: 2 } as const;

/** Suelo de seguridad no negociable: memoria mínima que deben pedir unos parámetros. */
export const MINIMUM_MEMORY_BYTES = 128 * 1024 * 1024;

/** Longitud de la llave derivada: 256 bits, para AES-256-GCM. */
const DERIVED_KEY_BYTES = 32;
const SALT_BYTES = 16;

export function createKdfParams(
  cost: { N: number; r: number; p: number } = RECOMMENDED_COST,
): KdfParams {
  return {
    algo: 'scrypt',
    N: cost.N,
    r: cost.r,
    p: cost.p,
    salt: bytesToBase64(randomBytes(SALT_BYTES)),
  };
}

/**
 * Deriva la KEK (Key Encryption Key) a partir de la contraseña maestra.
 *
 * Devuelve bytes crudos y no un CryptoKey a propósito: quien llama es responsable de
 * importarla, usarla y **borrarla de memoria** (`clean()`) en cuanto termine.
 *
 * Usa `scryptAsync` en vez de `scrypt` para ceder el hilo periódicamente: bloquear el
 * service worker un segundo entero congelaría también la UI del popup.
 */
export async function deriveKeyEncryptionKey(
  masterPassword: string,
  params: KdfParams,
): Promise<Uint8Array> {
  return scryptAsync(utf8ToBytes(masterPassword), base64ToBytes(params.salt), {
    N: params.N,
    r: params.r,
    p: params.p,
    dkLen: DERIVED_KEY_BYTES,
  });
}

/** Memoria que consumirán estos parámetros, en bytes. Útil para diagnóstico. */
export function estimatedMemoryBytes(params: Pick<KdfParams, 'N' | 'r'>): number {
  return 128 * params.N * params.r;
}
