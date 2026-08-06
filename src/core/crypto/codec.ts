/**
 * Conversión bytes ↔ base64.
 *
 * `Uint8Array.prototype.toBase64()` todavía no está disponible ni en Node 24 ni de forma
 * fiable en los navegadores objetivo, así que se usa btoa/atob (presentes en ambos)
 * troceando la entrada: `String.fromCharCode(...arr)` desborda la pila con arrays grandes.
 */

const CHUNK_SIZE = 0x8000;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}

/** Lanza si la entrada no es base64 válido — el llamador debe capturarlo. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function utf8ToBytes(text: string): Uint8Array {
  return encoder.encode(text);
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}
