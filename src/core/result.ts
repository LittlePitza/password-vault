/**
 * `Result<T, E>` para fallos **esperados**: contraseña incorrecta, registro corrupto,
 * versión de bóveda desconocida. Ninguno de esos es excepcional — son estados normales
 * que el llamador debe tratar, y el tipo le obliga a hacerlo.
 *
 * Las excepciones se reservan para errores del programador (invariantes rotas).
 */

interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/** Extrae el valor o lanza. Sólo para tests y para puntos donde el fallo es imposible. */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) {
    throw new Error(`unwrap() sobre un Result de error: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}
