import { type Result, err, ok } from '../result';
import { type CryptoError, corruptData } from './errors';
import { base64ToBytes, bytesToBase64 } from './codec';

/**
 * Cifrado simétrico con AES-256-GCM de WebCrypto.
 *
 * Se usa la implementación nativa del navegador en vez de una librería: está acelerada
 * por hardware y auditada por los propios fabricantes. GCM es cifrado *autenticado*, así
 * que descifrar con éxito prueba a la vez confidencialidad e integridad — alterar un solo
 * byte del ciphertext hace fallar la operación en vez de devolver datos manipulados.
 */

/** Un IV de 96 bits es el tamaño que GCM usa de forma nativa, sin derivación extra. */
const IV_BYTES = 12;

export interface Ciphertext {
  /** IV en base64. Único por operación — reutilizarlo con la misma llave rompe GCM. */
  readonly iv: string;
  /** Ciphertext + tag de autenticación, en base64. */
  readonly ct: string;
}

export async function importAesKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', rawKey as BufferSource, 'AES-GCM', true, [
    'encrypt',
    'decrypt',
  ]);
}

export async function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function exportAesKey(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey('raw', key));
}

export async function encryptBytes(key: CryptoKey, plaintext: Uint8Array): Promise<Ciphertext> {
  // Un IV nuevo por cada operación. Es lo que hace que cifrar dos veces el mismo texto
  // produzca ciphertexts distintos y que no se filtre qué registros son iguales.
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext as BufferSource,
  );
  return { iv: bytesToBase64(iv), ct: bytesToBase64(new Uint8Array(ct)) };
}

/**
 * Descifra y autentica.
 *
 * Devuelve `Result` en vez de lanzar porque el fallo aquí es un estado esperado —
 * contraseña incorrecta o registro dañado — y quien llama debe distinguirlo. El
 * mensaje de error nunca revela *por qué* falló: para un atacante, llave incorrecta y
 * dato manipulado deben ser indistinguibles.
 */
export async function decryptBytes(
  key: CryptoKey,
  ciphertext: Ciphertext,
): Promise<Result<Uint8Array, CryptoError>> {
  try {
    const iv = base64ToBytes(ciphertext.iv);
    const ct = base64ToBytes(ciphertext.ct);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ct as BufferSource,
    );
    return ok(new Uint8Array(plaintext));
  } catch {
    // Se captura sin inspeccionar: cualquier fallo (base64 inválido, IV corrupto, tag
    // que no cuadra) colapsa al mismo resultado a propósito.
    return err(corruptData('no se pudo descifrar o autenticar el registro'));
  }
}
