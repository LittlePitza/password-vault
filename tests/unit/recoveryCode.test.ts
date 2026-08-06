import { describe, expect, it } from 'vitest';
import { generateRecoveryCode } from '@/src/core/crypto/recoveryCode';
import {
  RECOVERY_CODE_BITS,
  formatRecoveryCode,
  isWellFormedRecoveryCode,
  normalizeRecoveryCode,
} from '@/src/core/model/recoveryCodeFormat';
import {
  createVault,
  migrateMeta,
  regenerateRecoveryCode,
  resetMasterPassword,
  unlockVault,
  unlockWithRecoveryCode,
} from '@/src/core/crypto/vaultKey';
import { decryptBytes, encryptBytes } from '@/src/core/crypto/aes';
import { bytesToUtf8, utf8ToBytes } from '@/src/core/crypto/codec';
import { TEST_COST } from './fakes';

const MASTER = 'una frase larga y memorable';
const NOW = 1_700_000_000_000;

describe('formato del código de respaldo', () => {
  it('tiene 120 bits y se muestra en seis grupos de cuatro', () => {
    const code = generateRecoveryCode();

    expect(RECOVERY_CODE_BITS).toBe(120);
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){5}$/);
    expect(normalizeRecoveryCode(code)).toHaveLength(24);
  });

  it('nunca usa caracteres que se confunden al escribir a mano', () => {
    // El alfabeto de Crockford omite I, L, O y U precisamente por esto.
    for (let i = 0; i < 200; i++) {
      expect(generateRecoveryCode()).not.toMatch(/[ILOU]/);
    }
  });

  it('no repite códigos', () => {
    const generated = new Set(Array.from({ length: 500 }, () => generateRecoveryCode()));
    expect(generated.size).toBe(500);
  });

  it('perdona las confusiones típicas de transcripción', () => {
    const canonical = normalizeRecoveryCode('0123-4567-89AB-CDEF-GHJK-MNPQ');

    // Apuntar O por 0, o l/I por 1, no debe costar la bóveda.
    expect(normalizeRecoveryCode('O123-4567-89AB-CDEF-GHJK-MNPQ')).toBe(canonical);
    expect(normalizeRecoveryCode('0l23-4567-89ab-cdef-ghjk-mnpq')).toBe(canonical);
    expect(normalizeRecoveryCode('0I23456789ABCDEFGHJKMNPQ')).toBe(canonical);
    // Y da igual cómo se separe o si va en minúsculas.
    expect(normalizeRecoveryCode('0123 4567 89ab cdef ghjk mnpq')).toBe(canonical);
  });

  it('valida la forma antes de gastar un scrypt entero', () => {
    expect(isWellFormedRecoveryCode(generateRecoveryCode())).toBe(true);
    expect(isWellFormedRecoveryCode('demasiado-corto')).toBe(false);
    expect(isWellFormedRecoveryCode('')).toBe(false);
    // El guion sobrante y las minúsculas sí se toleran.
    expect(isWellFormedRecoveryCode(generateRecoveryCode().toLowerCase())).toBe(true);
  });

  it('reformatea un código pegado sin guiones', () => {
    const code = generateRecoveryCode();
    expect(formatRecoveryCode(normalizeRecoveryCode(code))).toBe(code);
  });
});

describe('la DEK envuelta para dos destinatarios', () => {
  it('la maestra y el código abren la MISMA llave', async () => {
    const { meta, dek, recoveryCode } = await createVault(MASTER, NOW, TEST_COST);
    const sealed = await encryptBytes(dek, utf8ToBytes('mismo secreto'));

    const viaMaster = await unlockVault(MASTER, meta);
    const viaRecovery = await unlockWithRecoveryCode(recoveryCode, meta);

    expect(viaMaster.ok).toBe(true);
    expect(viaRecovery.ok).toBe(true);
    if (!viaMaster.ok || !viaRecovery.ok) return;

    for (const key of [viaMaster.value, viaRecovery.value]) {
      const opened = await decryptBytes(key, sealed);
      expect(opened.ok).toBe(true);
      if (opened.ok) expect(bytesToUtf8(opened.value)).toBe('mismo secreto');
    }
  });

  it('cada destinatario tiene su propio salt', async () => {
    const { meta } = await createVault(MASTER, NOW, TEST_COST);

    expect(meta.recoveryKdf?.salt).toBeDefined();
    expect(meta.recoveryKdf?.salt).not.toBe(meta.kdf.salt);
    expect(meta.wrappedDek.recovery?.ct).not.toBe(meta.wrappedDek.master.ct);
  });

  it('el código de respaldo no abre otra bóveda', async () => {
    const mine = await createVault(MASTER, NOW, TEST_COST);
    const other = await createVault(MASTER, NOW, TEST_COST);

    const attempt = await unlockWithRecoveryCode(mine.recoveryCode, other.meta);

    expect(attempt.ok).toBe(false);
  });

  it('rechaza un código incorrecto', async () => {
    const { meta } = await createVault(MASTER, NOW, TEST_COST);

    const attempt = await unlockWithRecoveryCode('0000-0000-0000-0000-0000-0000', meta);

    expect(attempt.ok).toBe(false);
    if (!attempt.ok) expect(attempt.error.kind).toBe('wrong-password');
  });

  it('acepta el código tecleado con minúsculas y sin guiones', async () => {
    const { meta, recoveryCode } = await createVault(MASTER, NOW, TEST_COST);

    const sloppy = recoveryCode.toLowerCase().replace(/-/g, ' ');
    expect((await unlockWithRecoveryCode(sloppy, meta)).ok).toBe(true);
  });
});

describe('independencia entre los dos destinatarios', () => {
  it('cambiar la contraseña maestra NO invalida el código de respaldo', async () => {
    const { meta, dek, recoveryCode } = await createVault(MASTER, NOW, TEST_COST);

    const withNewMaster = await resetMasterPassword('otra frase igual de larga', dek, meta);

    expect((await unlockWithRecoveryCode(recoveryCode, withNewMaster)).ok).toBe(true);
    expect((await unlockVault('otra frase igual de larga', withNewMaster)).ok).toBe(true);
    expect((await unlockVault(MASTER, withNewMaster)).ok).toBe(false);
  });

  it('regenerar el código NO invalida la contraseña maestra', async () => {
    const { meta, dek, recoveryCode } = await createVault(MASTER, NOW, TEST_COST);

    const rotated = await regenerateRecoveryCode(dek, meta);

    expect((await unlockVault(MASTER, rotated.meta)).ok).toBe(true);
    expect((await unlockWithRecoveryCode(rotated.recoveryCode, rotated.meta)).ok).toBe(true);
    // El anterior queda muerto: es el punto de rotarlo.
    expect((await unlockWithRecoveryCode(recoveryCode, rotated.meta)).ok).toBe(false);
  });

  it('tras recuperar y rotar, los datos siguen siendo los mismos', async () => {
    const { meta, dek, recoveryCode } = await createVault(MASTER, NOW, TEST_COST);
    const sealed = await encryptBytes(dek, utf8ToBytes('dato anterior al olvido'));

    // Se olvidó la maestra: se entra con el código...
    const recovered = await unlockWithRecoveryCode(recoveryCode, meta);
    expect(recovered.ok).toBe(true);
    if (!recovered.ok) return;

    // ...se fija una maestra nueva y se rota el código gastado.
    const withNewMaster = await resetMasterPassword(
      'la nueva frase maestra',
      recovered.value,
      meta,
    );
    const rotated = await regenerateRecoveryCode(recovered.value, withNewMaster);

    const unlocked = await unlockVault('la nueva frase maestra', rotated.meta);
    expect(unlocked.ok).toBe(true);
    if (!unlocked.ok) return;

    const opened = await decryptBytes(unlocked.value, sealed);
    expect(opened.ok).toBe(true);
    if (opened.ok) expect(bytesToUtf8(opened.value)).toBe('dato anterior al olvido');
  });
});

describe('migración de bóvedas v1', () => {
  it('reinterpreta el envoltorio antiguo como la entrada maestra', async () => {
    const { meta } = await createVault(MASTER, NOW, TEST_COST);

    // Así se veía una cabecera de v1: wrappedDek era el Ciphertext directamente.
    const legacy = {
      version: 1,
      kdf: meta.kdf,
      wrappedDek: meta.wrappedDek.master,
      createdAt: NOW,
    };

    const migrated = migrateMeta(legacy);
    expect(migrated).not.toBeNull();
    if (migrated === null) return;

    expect(migrated.version).toBe(2);
    expect(migrated.wrappedDek.master).toEqual(meta.wrappedDek.master);
    expect(migrated.wrappedDek.recovery).toBeUndefined();
    // Y lo importante: la contraseña de siempre sigue abriéndola.
    expect((await unlockVault(MASTER, migrated)).ok).toBe(true);
  });

  it('una bóveda migrada sin código rechaza cualquier intento de recuperación', async () => {
    const { meta, recoveryCode } = await createVault(MASTER, NOW, TEST_COST);
    const migrated = migrateMeta({
      version: 1,
      kdf: meta.kdf,
      wrappedDek: meta.wrappedDek.master,
      createdAt: NOW,
    });
    if (migrated === null) throw new Error('la migración devolvió null');

    const attempt = await unlockWithRecoveryCode(recoveryCode, migrated);

    expect(attempt.ok).toBe(false);
  });

  it('deja intacta una cabecera que ya es v2', async () => {
    const { meta } = await createVault(MASTER, NOW, TEST_COST);
    expect(migrateMeta(meta)).toEqual(meta);
  });

  it('devuelve null ante basura', () => {
    expect(migrateMeta(null)).toBeNull();
    expect(migrateMeta('no soy una cabecera')).toBeNull();
    expect(migrateMeta({})).toBeNull();
  });
});
