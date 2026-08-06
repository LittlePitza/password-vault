import { describe, expect, it } from 'vitest';
import {
  MINIMUM_MEMORY_BYTES,
  MODERATE_COST,
  RECOMMENDED_COST,
  createKdfParams,
  deriveKeyEncryptionKey,
  estimatedMemoryBytes,
} from '@/src/core/crypto/kdf';

/**
 * Calibración del KDF con los parámetros **reales**, no los débiles del resto de tests.
 *
 * La lentitud aquí es la característica: es el peaje que paga un atacante por cada
 * intento de fuerza bruta.
 *
 * La comprobación de seguridad de verdad es sobre los **parámetros**, no sobre el reloj:
 * un test de tiempo depende de qué tan rápida sea la máquina que lo ejecuta, así que en
 * un equipo potente podría fallar sin que nada se haya roto. El tiempo se mide igualmente,
 * pero con una banda ancha, sólo para atrapar una configuración catastrófica.
 */

describe('parámetros de scrypt (invariante de seguridad)', () => {
  it('los parámetros recomendados cumplen el mínimo de OWASP', () => {
    expect(RECOMMENDED_COST.N).toBeGreaterThanOrEqual(2 ** 17);
    expect(RECOMMENDED_COST.r).toBeGreaterThanOrEqual(8);
    expect(RECOMMENDED_COST.p).toBeGreaterThanOrEqual(1);
  });

  it('piden al menos 128 MiB de memoria', () => {
    // Es la propiedad memory-hard: lo que encarece atacar con GPU o ASIC.
    expect(estimatedMemoryBytes(RECOMMENDED_COST)).toBeGreaterThanOrEqual(MINIMUM_MEMORY_BYTES);
    expect(estimatedMemoryBytes(RECOMMENDED_COST)).toBe(128 * 1024 * 1024);
  });

  it('no piden tanta memoria como para arriesgar que el service worker muera', () => {
    // 256 MiB dentro de un service worker de MV3 es territorio peligroso.
    expect(estimatedMemoryBytes(RECOMMENDED_COST)).toBeLessThanOrEqual(128 * 1024 * 1024);
  });

  it('el escalón moderado no baja de 64 MiB', () => {
    expect(estimatedMemoryBytes(MODERATE_COST)).toBeGreaterThanOrEqual(64 * 1024 * 1024);
  });
});

describe('coste real medido', () => {
  it('desbloquear cuesta lo suficiente sin volverse molesto', { timeout: 60_000 }, async () => {
    const params = createKdfParams(RECOMMENDED_COST);

    const started = performance.now();
    await deriveKeyEncryptionKey('una contraseña maestra de ejemplo', params);
    const elapsed = performance.now() - started;

    // Banda ancha a propósito: en la máquina de referencia son ~540 ms, pero un equipo
    // el doble de rápido o el triple de lento sigue estando dentro de lo aceptable.
    expect(elapsed).toBeGreaterThan(100);
    expect(elapsed).toBeLessThan(3000);
  });
});

describe('propiedades de la derivación', () => {
  it('deriva 32 bytes, el tamaño de una llave AES-256', async () => {
    const key = await deriveKeyEncryptionKey('x', createKdfParams(MODERATE_COST));
    expect(key).toHaveLength(32);
  });

  it('la misma contraseña y el mismo salt dan siempre la misma llave', async () => {
    const params = createKdfParams(MODERATE_COST);

    const first = await deriveKeyEncryptionKey('repetible', params);
    const second = await deriveKeyEncryptionKey('repetible', params);

    expect(first).toEqual(second);
  });

  it('salts distintos dan llaves distintas para la misma contraseña', async () => {
    const first = await deriveKeyEncryptionKey('igual', createKdfParams(MODERATE_COST));
    const second = await deriveKeyEncryptionKey('igual', createKdfParams(MODERATE_COST));

    expect(first).not.toEqual(second);
  });

  it('los parámetros viajan con la bóveda, para poder endurecerlos sin romperla', () => {
    const params = createKdfParams(RECOMMENDED_COST);

    expect(params).toMatchObject({ algo: 'scrypt', ...RECOMMENDED_COST });
    expect(params.salt).toBeTypeOf('string');
  });
});
