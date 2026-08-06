import { type Result, err, ok } from '../result';
import { type CryptoError, corruptData } from '../crypto/errors';
import { type Ciphertext, decryptBytes, encryptBytes } from '../crypto/aes';
import { bytesToUtf8, utf8ToBytes } from '../crypto/codec';
import { type VaultItem, vaultItemSchema } from '../model/item';

/**
 * Serializa y cifra un item completo — incluidos título y URLs.
 *
 * Cifrar *todo* el registro, y no sólo los campos "secretos", es deliberado: si el
 * título y la URL fuesen en claro, la bóveda en disco revelaría en qué sitios tienes
 * cuenta. Eso ya es información sensible por sí sola.
 */
export async function encryptItem(dek: CryptoKey, item: VaultItem): Promise<Ciphertext> {
  const plaintext = utf8ToBytes(JSON.stringify(item));
  return encryptBytes(dek, plaintext);
}

/**
 * Descifra, parsea y **valida** un item.
 *
 * La validación con zod no es redundante: GCM prueba que el dato es auténtico, no que
 * tenga la forma esperada. Un registro escrito por una versión distinta del esquema debe
 * fallar aquí y no colarse medio construido en la aplicación.
 */
export async function decryptItem(
  dek: CryptoKey,
  ciphertext: Ciphertext,
): Promise<Result<VaultItem, CryptoError>> {
  const plaintext = await decryptBytes(dek, ciphertext);
  if (!plaintext.ok) return plaintext;

  let parsed: unknown;
  try {
    parsed = JSON.parse(bytesToUtf8(plaintext.value));
  } catch {
    return err(corruptData('el registro descifrado no es JSON válido'));
  }

  const validated = vaultItemSchema.safeParse(parsed);
  if (!validated.success) {
    return err(
      corruptData(
        `el registro no cumple el esquema: ${validated.error.issues[0]?.message ?? 'forma desconocida'}`,
      ),
    );
  }

  return ok(validated.data);
}
