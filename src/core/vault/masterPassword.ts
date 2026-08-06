import { type Result, err, ok } from '../result';
import { type VaultError, weakMasterPassword } from './errors';

/**
 * Política de la contraseña maestra.
 *
 * Es la única contraseña que el usuario debe recordar y la única cuya fuerza no podemos
 * garantizar generándola nosotros, así que se valida al crearla — después ya es tarde:
 * no hay recuperación ni forma de re-cifrar sin ella.
 *
 * Se exige **longitud** y no la clásica receta de "una mayúscula, un número y un
 * símbolo". Esas reglas empujan a la gente hacia `Password1!`, que es corta y predecible;
 * una frase larga es más fuerte y más fácil de recordar. Es también la recomendación
 * actual de NIST.
 */

export const MIN_MASTER_PASSWORD_LENGTH = 12;

/** Contraseñas tan comunes que aparecerían en cualquier ataque de diccionario. */
const OBVIOUS = new Set([
  'contraseña',
  'contrasena',
  'password',
  'passw0rd',
  '123456789012',
  'qwertyuiop',
  'administrador',
  'passwordpassword',
]);

export function validateMasterPassword(password: string): Result<void, VaultError> {
  if (password.length < MIN_MASTER_PASSWORD_LENGTH) {
    return err(
      weakMasterPassword(
        `La contraseña maestra debe tener al menos ${String(MIN_MASTER_PASSWORD_LENGTH)} caracteres. Una frase que recuerdes es mejor que una palabra corta con símbolos.`,
      ),
    );
  }

  if (OBVIOUS.has(password.toLowerCase())) {
    return err(
      weakMasterPassword('Esa contraseña es demasiado común. Cualquier ataque la probaría.'),
    );
  }

  if (new Set(password).size < 5) {
    return err(
      weakMasterPassword('La contraseña repite muy pocos caracteres distintos. Usa una frase.'),
    );
  }

  return ok(undefined);
}
