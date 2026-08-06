/**
 * Formato del código de respaldo: alfabeto, normalización y validación de forma.
 *
 * Vive aquí y no en `crypto/` a propósito. La generación del código necesita
 * aleatoriedad criptográfica y pertenece al núcleo de cifrado, al que la interfaz no
 * puede acceder — la regla de frontera de ESLint lo impide, y con razón. Pero decidir si
 * habilitar un botón porque el usuario ya tecleó 24 caracteres válidos es una cuestión de
 * presentación, sin secretos de por medio.
 *
 * ── Por qué base32 de Crockford ───────────────────────────────────────────────
 * El código se escribe en papel y se vuelve a teclear meses después. Este alfabeto omite
 * `I`, `L`, `O` y `U` porque se confunden con `1`, `0` y `V` al leer una nota a mano, y la
 * normalización corrige esas confusiones sola: apuntar `O` en lugar de `0` no arruina el
 * respaldo.
 */

/** Alfabeto de Crockford: sin I, L, O ni U. */
export const RECOVERY_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** 15 bytes = 120 bits = 24 caracteres base32 exactos, sin relleno. */
export const RECOVERY_CODE_BYTES = 15;
export const RECOVERY_CODE_LENGTH = 24;
export const RECOVERY_CODE_BITS = RECOVERY_CODE_BYTES * 8;

const GROUP_SIZE = 4;

/** Agrupa en bloques de cuatro separados por guiones, para copiarlo sin errores. */
export function formatRecoveryCode(code: string): string {
  const compact = normalizeRecoveryCode(code);
  const groups: string[] = [];
  for (let i = 0; i < compact.length; i += GROUP_SIZE) {
    groups.push(compact.slice(i, i + GROUP_SIZE));
  }
  return groups.join('-');
}

/**
 * Lleva lo que teclea el usuario a la forma canónica.
 *
 * Quita guiones y espacios, pasa a mayúsculas y corrige las confusiones clásicas de
 * transcripción.
 */
export function normalizeRecoveryCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0')
    .replace(/U/g, 'V');
}

/** Comprueba la forma antes de gastar un scrypt completo en un código imposible. */
export function isWellFormedRecoveryCode(input: string): boolean {
  const normalized = normalizeRecoveryCode(input);
  if (normalized.length !== RECOVERY_CODE_LENGTH) return false;

  for (const char of normalized) {
    if (!RECOVERY_ALPHABET.includes(char)) return false;
  }
  return true;
}
