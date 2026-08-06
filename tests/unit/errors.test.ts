import { describe, expect, it } from 'vitest';
import { describeVaultError, unexpected } from '@/src/core/vault/errors';

/**
 * La variante `unexpected`: el envoltorio de todo lo que ningún caso de uso previó.
 *
 * Es la red que impide que una excepción del navegador —cuota agotada, storage caído—
 * deje al popup esperando una respuesta que no va a llegar.
 */
describe('unexpected()', () => {
  it('extrae el mensaje de un Error', () => {
    const error = unexpected(new Error('QUOTA_BYTES quota exceeded'));

    expect(error.kind).toBe('unexpected');
    if (error.kind === 'unexpected') {
      expect(error.detail).toBe('QUOTA_BYTES quota exceeded');
    }
  });

  it('admite que se lance algo que no es un Error', () => {
    // En JavaScript se puede lanzar cualquier cosa, y `catch (e)` recibe `unknown`.
    const error = unexpected({ raro: true });

    expect(error.kind).toBe('unexpected');
  });

  it('trunca detalles largos', () => {
    const error = unexpected(new Error('x'.repeat(5_000)));

    if (error.kind === 'unexpected') {
      expect(error.detail.length).toBeLessThanOrEqual(200);
    }
  });

  it('sobrevive a la serialización del canal de mensajes', () => {
    // Cruza `sendMessage`, así que tiene que ser structured-clonable como el resto de
    // la unión: si llevara una instancia de Error, llegaría vacío al otro lado.
    const error = unexpected(new Error('fallo'));

    expect(JSON.parse(JSON.stringify(error))).toEqual(error);
  });
});

describe('describeVaultError()', () => {
  it('no enseña el detalle interno al usuario', () => {
    // El detalle puede arrastrar el mensaje de una excepción cualquiera, y una excepción
    // cualquiera puede haber tocado contenido de la bóveda. A la pantalla no llega.
    const secreto = 'MiContraseñaSuperSecreta';
    const mensaje = describeVaultError(unexpected(new Error(secreto)));

    expect(mensaje).not.toContain(secreto);
    expect(mensaje.length).toBeGreaterThan(0);
  });

  it('da un texto accionable en vez de un código', () => {
    expect(describeVaultError(unexpected('lo que sea'))).toMatch(/intentarlo/i);
  });
});
