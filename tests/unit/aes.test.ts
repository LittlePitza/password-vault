import { describe, expect, it } from 'vitest';
import { decryptBytes, encryptBytes, generateAesKey } from '@/src/core/crypto/aes';
import { base64ToBytes, bytesToBase64, bytesToUtf8, utf8ToBytes } from '@/src/core/crypto/codec';

describe('AES-256-GCM', () => {
  it('descifra exactamente lo que se cifró', async () => {
    const key = await generateAesKey();
    const original = 'contraseña con acentos, emoji 🔐 y símbolos <>&"';

    const sealed = await encryptBytes(key, utf8ToBytes(original));
    const opened = await decryptBytes(key, sealed);

    expect(opened.ok).toBe(true);
    if (opened.ok) expect(bytesToUtf8(opened.value)).toBe(original);
  });

  it('usa un IV nuevo por operación, así que el mismo texto da ciphertext distinto', async () => {
    const key = await generateAesKey();
    const plaintext = utf8ToBytes('el mismo texto exacto');

    const first = await encryptBytes(key, plaintext);
    const second = await encryptBytes(key, plaintext);

    expect(first.iv).not.toBe(second.iv);
    expect(first.ct).not.toBe(second.ct);
  });

  it('falla si se altera un solo byte del ciphertext', async () => {
    const key = await generateAesKey();
    const sealed = await encryptBytes(key, utf8ToBytes('dato íntegro'));

    const bytes = base64ToBytes(sealed.ct);
    bytes[0] = (bytes[0]! ^ 0x01) & 0xff; // un bit distinto basta
    const tampered = { iv: sealed.iv, ct: bytesToBase64(bytes) };

    const opened = await decryptBytes(key, tampered);

    expect(opened.ok).toBe(false);
    if (!opened.ok) expect(opened.error.kind).toBe('corrupt-data');
  });

  it('falla si se altera el IV', async () => {
    const key = await generateAesKey();
    const sealed = await encryptBytes(key, utf8ToBytes('dato íntegro'));

    const iv = base64ToBytes(sealed.iv);
    iv[0] = (iv[0]! ^ 0xff) & 0xff;

    const opened = await decryptBytes(key, { iv: bytesToBase64(iv), ct: sealed.ct });

    expect(opened.ok).toBe(false);
  });

  it('falla con una llave distinta', async () => {
    const sealed = await encryptBytes(await generateAesKey(), utf8ToBytes('secreto'));

    const opened = await decryptBytes(await generateAesKey(), sealed);

    expect(opened.ok).toBe(false);
  });

  it('devuelve Result de error en vez de lanzar ante base64 inválido', async () => {
    const key = await generateAesKey();

    const opened = await decryptBytes(key, { iv: 'no-es-base64!!', ct: 'tampoco!!' });

    expect(opened.ok).toBe(false);
  });
});

describe('codec base64', () => {
  it('hace round-trip de bytes arbitrarios', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(1024));
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('soporta arrays grandes sin desbordar la pila', () => {
    // El troceado de codec.ts existe justamente por esto: con 200 KB de entrada,
    // String.fromCharCode(...bytes) desbordaría la pila de argumentos.
    // (getRandomValues sólo acepta 64 KB por llamada, de ahí el bucle.)
    const big = new Uint8Array(200_000);
    for (let offset = 0; offset < big.length; offset += 65_536) {
      crypto.getRandomValues(big.subarray(offset, Math.min(offset + 65_536, big.length)));
    }

    expect(base64ToBytes(bytesToBase64(big))).toEqual(big);
  });

  it('hace round-trip de UTF-8 multibyte', () => {
    const text = 'ñÁ日本語🔐';
    expect(bytesToUtf8(utf8ToBytes(text))).toBe(text);
  });
});
