import { describe, expect, it } from 'vitest';
import {
  changeMasterPassword,
  createVault,
  unlockVault,
  VAULT_FORMAT_VERSION,
} from '@/src/core/crypto/vaultKey';
import { decryptBytes, encryptBytes } from '@/src/core/crypto/aes';
import { bytesToUtf8, utf8ToBytes } from '@/src/core/crypto/codec';
import { TEST_COST } from './fakes';

const PASSWORD = 'una contraseña maestra correcta';
const NOW = 1_700_000_000_000;

describe('jerarquía de llaves', () => {
  it('desbloquea con la contraseña correcta y devuelve una DEK usable', async () => {
    const { meta, dek } = await createVault(PASSWORD, NOW, TEST_COST);

    const unlocked = await unlockVault(PASSWORD, meta);
    expect(unlocked.ok).toBe(true);
    if (!unlocked.ok) return;

    // La DEK recuperada debe ser la misma: lo que cifra una, lo descifra la otra.
    const sealed = await encryptBytes(dek, utf8ToBytes('secreto'));
    const opened = await decryptBytes(unlocked.value, sealed);
    expect(opened.ok).toBe(true);
    if (opened.ok) expect(bytesToUtf8(opened.value)).toBe('secreto');
  });

  it('rechaza una contraseña incorrecta con Result de error, no con datos basura', async () => {
    const { meta } = await createVault(PASSWORD, NOW, TEST_COST);

    const unlocked = await unlockVault('contraseña equivocada', meta);

    expect(unlocked.ok).toBe(false);
    if (!unlocked.ok) expect(unlocked.error.kind).toBe('wrong-password');
  });

  it('no distingue una contraseña casi correcta de una totalmente distinta', async () => {
    const { meta } = await createVault(PASSWORD, NOW, TEST_COST);

    const almost = await unlockVault(PASSWORD + 'x', meta);
    const totally = await unlockVault('nada que ver', meta);

    expect(almost.ok).toBe(false);
    expect(totally.ok).toBe(false);
    if (!almost.ok && !totally.ok) {
      expect(almost.error).toEqual(totally.error);
    }
  });

  it('genera un salt distinto por bóveda', async () => {
    const a = await createVault(PASSWORD, NOW, TEST_COST);
    const b = await createVault(PASSWORD, NOW, TEST_COST);

    expect(a.meta.kdf.salt).not.toBe(b.meta.kdf.salt);
    // Misma contraseña, salt distinto ⇒ DEK envuelta distinta.
    expect(a.meta.wrappedDek.master.ct).not.toBe(b.meta.wrappedDek.master.ct);
  });

  it('rechaza una bóveda de una versión de formato futura', async () => {
    const { meta } = await createVault(PASSWORD, NOW, TEST_COST);
    const fromTheFuture = { ...meta, version: VAULT_FORMAT_VERSION + 1 };

    const unlocked = await unlockVault(PASSWORD, fromTheFuture);

    expect(unlocked.ok).toBe(false);
    if (!unlocked.ok) expect(unlocked.error.kind).toBe('unsupported-version');
  });
});

describe('cambio de contraseña maestra', () => {
  it('conserva la DEK, de modo que los items siguen descifrándose', async () => {
    const { meta, dek } = await createVault(PASSWORD, NOW, TEST_COST);
    const sealed = await encryptBytes(dek, utf8ToBytes('dato guardado antes del cambio'));

    const changed = await changeMasterPassword(PASSWORD, 'la nueva contraseña', meta);
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;

    const unlocked = await unlockVault('la nueva contraseña', changed.value);
    expect(unlocked.ok).toBe(true);
    if (!unlocked.ok) return;

    const opened = await decryptBytes(unlocked.value, sealed);
    expect(opened.ok).toBe(true);
    if (opened.ok) expect(bytesToUtf8(opened.value)).toBe('dato guardado antes del cambio');
  });

  it('invalida la contraseña anterior', async () => {
    const { meta } = await createVault(PASSWORD, NOW, TEST_COST);

    const changed = await changeMasterPassword(PASSWORD, 'la nueva contraseña', meta);
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;

    const withOld = await unlockVault(PASSWORD, changed.value);
    expect(withOld.ok).toBe(false);
  });

  it('renueva el salt para que ambas contraseñas no compartan derivación', async () => {
    const { meta } = await createVault(PASSWORD, NOW, TEST_COST);

    const changed = await changeMasterPassword(PASSWORD, 'la nueva contraseña', meta);
    expect(changed.ok).toBe(true);
    if (changed.ok) expect(changed.value.kdf.salt).not.toBe(meta.kdf.salt);
  });

  it('falla si la contraseña actual es incorrecta', async () => {
    const { meta } = await createVault(PASSWORD, NOW, TEST_COST);

    const changed = await changeMasterPassword('no es la actual', 'da igual', meta);

    expect(changed.ok).toBe(false);
    if (!changed.ok) expect(changed.error.kind).toBe('wrong-password');
  });
});
