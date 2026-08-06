import { describe, expect, it } from 'vitest';
import { encryptBytes, generateAesKey } from '@/src/core/crypto/aes';
import { utf8ToBytes } from '@/src/core/crypto/codec';
import { decryptItem, encryptItem } from '@/src/core/vault/itemCodec';
import type { LoginItem } from '@/src/core/model/item';

const item: LoginItem = {
  id: '00000000-0000-4000-8000-000000000001',
  type: 'login',
  title: 'Ejemplo',
  favorite: false,
  createdAt: 1,
  updatedAt: 2,
  username: 'usuario',
  password: 'clave',
  urls: ['https://ejemplo.com'],
};

describe('validación al descifrar', () => {
  it('hace round-trip de un item válido', async () => {
    const dek = await generateAesKey();

    const decrypted = await decryptItem(dek, await encryptItem(dek, item));

    expect(decrypted.ok).toBe(true);
    if (decrypted.ok) expect(decrypted.value).toEqual(item);
  });

  it('rechaza un registro que descifra bien pero no cumple el esquema', async () => {
    // Auténtico e íntegro para GCM, pero le falta `password` y `urls`. Es exactamente
    // el caso que zod existe para atrapar: descifrar con éxito no implica forma correcta.
    const dek = await generateAesKey();
    const malformed = await encryptBytes(
      dek,
      utf8ToBytes(JSON.stringify({ ...item, password: undefined, urls: undefined })),
    );

    const decrypted = await decryptItem(dek, malformed);

    expect(decrypted.ok).toBe(false);
    if (!decrypted.ok) expect(decrypted.error.kind).toBe('corrupt-data');
  });

  it('rechaza un registro con un tipo de item desconocido', async () => {
    const dek = await generateAesKey();
    const unknownType = await encryptBytes(
      dek,
      utf8ToBytes(JSON.stringify({ ...item, type: 'crypto-wallet' })),
    );

    const decrypted = await decryptItem(dek, unknownType);

    expect(decrypted.ok).toBe(false);
  });

  it('rechaza texto plano que no es JSON', async () => {
    const dek = await generateAesKey();
    const notJson = await encryptBytes(dek, utf8ToBytes('esto no es JSON'));

    const decrypted = await decryptItem(dek, notJson);

    expect(decrypted.ok).toBe(false);
    // `detail` sólo existe en la variante 'corrupt-data', así que hay que estrechar por
    // `kind` antes de leerlo: la unión discriminada no deja tomar atajos.
    if (!decrypted.ok && decrypted.error.kind === 'corrupt-data') {
      expect(decrypted.error.detail).toContain('JSON');
    }
  });
});
