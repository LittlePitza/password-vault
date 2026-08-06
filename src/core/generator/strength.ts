import { type StrengthLevel, strengthOf } from './generator';

/**
 * Estimación de la fuerza de una contraseña **escrita por el usuario**.
 *
 * Es distinta de `entropyBits()`: allí conocemos el alfabeto porque lo elegimos nosotros,
 * aquí hay que inferirlo de lo que se ha tecleado.
 *
 * Honestamente: esto es una **guía visual, no un oráculo**. Un estimador serio necesita
 * diccionarios y detección de patrones (`zxcvbn` y similares), lo que añadiría cientos de
 * kilobytes al paquete. Lo que hace este cálculo es premiar la longitud y la variedad, y
 * castigar la repetición — suficiente para orientar a quien está creando su contraseña
 * maestra, y deliberadamente conservador para no dar una falsa sensación de seguridad.
 */

export interface PasswordStrength {
  readonly bits: number;
  readonly level: StrengthLevel;
}

export function estimatePasswordStrength(password: string): PasswordStrength {
  if (password.length === 0) return { bits: 0, level: 'weak' };

  const alphabetSize = inferredAlphabetSize(password);
  const uniqueRatio = new Set(password).size / password.length;

  // La repetición reduce la entropía real: 'aaaaaaaaaaaa' no vale lo que su longitud
  // sugiere. Se escala por la proporción de caracteres distintos.
  const effectiveLength = password.length * uniqueRatio;
  const bits = Math.log2(alphabetSize) * effectiveLength;

  return { bits, level: strengthOf(bits) };
}

function inferredAlphabetSize(password: string): number {
  let size = 0;
  if (/[a-z]/.test(password)) size += 26;
  if (/[A-Z]/.test(password)) size += 26;
  if (/\d/.test(password)) size += 10;
  if (/[^a-zA-Z\d]/.test(password)) size += 33; // símbolos y espacio
  return Math.max(size, 2);
}

export function describeStrength(level: StrengthLevel): string {
  switch (level) {
    case 'weak':
      return 'Débil';
    case 'fair':
      return 'Aceptable';
    case 'strong':
      return 'Fuerte';
    case 'excellent':
      return 'Excelente';
  }
}
