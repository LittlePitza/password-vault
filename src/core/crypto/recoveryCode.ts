import { randomBytes } from '@noble/hashes/utils.js';
import {
  RECOVERY_ALPHABET,
  RECOVERY_CODE_BYTES,
  formatRecoveryCode,
} from '../model/recoveryCodeFormat';

/**
 * Generación del código de respaldo: la segunda llave que abre la bóveda si se olvida la
 * contraseña maestra.
 *
 * El **formato** (alfabeto, normalización, validación) vive en
 * `model/recoveryCodeFormat.ts`, al que sí puede acceder la interfaz. Aquí queda sólo lo
 * que necesita aleatoriedad criptográfica.
 *
 * ── Por qué 120 bits ──────────────────────────────────────────────────────────
 * Dan exactamente 24 caracteres sin relleno, agrupables en seis bloques de cuatro. Y son
 * bits *reales* de aleatoriedad, a diferencia de una contraseña humana: aquí no hay
 * diccionario que valga y adivinarlo es inviable con cualquier presupuesto.
 *
 * ── Advertencia de uso ────────────────────────────────────────────────────────
 * Es un token al portador: quien lo tenga abre la bóveda sin necesitar la contraseña
 * maestra. Debe guardarse como se guarda una llave física, no como se guarda un archivo.
 */

/** Genera un código nuevo, ya formateado para mostrarlo: `XXXX-XXXX-…`. */
export function generateRecoveryCode(): string {
  return formatRecoveryCode(encodeBase32(randomBytes(RECOVERY_CODE_BYTES)));
}

function encodeBase32(bytes: Uint8Array): string {
  let value = 0;
  let bits = 0;
  let output = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += symbolAt((value >>> bits) & 31);
    }
  }

  // Con 120 bits (múltiplo de 5) nunca quedan bits sueltos, pero se contempla por si
  // algún día cambia RECOVERY_CODE_BYTES.
  if (bits > 0) output += symbolAt((value << (5 - bits)) & 31);

  return output;
}

/** El índice siempre viene enmascarado con `& 31` y el alfabeto tiene 32 símbolos. */
function symbolAt(index: number): string {
  const symbol = RECOVERY_ALPHABET[index];
  /* v8 ignore next -- inalcanzable: la máscara garantiza 0..31 */
  if (symbol === undefined) throw new Error(`Índice fuera del alfabeto: ${String(index)}`);
  return symbol;
}
