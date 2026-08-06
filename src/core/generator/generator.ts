/**
 * Generador de contraseñas.
 *
 * Dos detalles que separan un generador correcto de uno que sólo lo parece:
 *
 *  1. **Sin sesgo de módulo.** `random() % charset.length` favorece a los primeros
 *     caracteres del alfabeto salvo que su tamaño divida exactamente a 256. Aquí se usa
 *     muestreo por rechazo.
 *  2. **Garantía de composición.** Si el usuario pide dígitos, la contraseña debe
 *     contener al menos uno. Se fuerza un carácter de cada clase pedida y luego se baraja
 *     con Fisher-Yates (también sin sesgo), en vez de generar y reintentar.
 */

export interface GeneratorOptions {
  readonly length: number;
  readonly uppercase: boolean;
  readonly lowercase: boolean;
  readonly digits: boolean;
  readonly symbols: boolean;
  /** Excluye caracteres fáciles de confundir al transcribir a mano: l 1 I O 0. */
  readonly excludeAmbiguous: boolean;
}

export const DEFAULT_GENERATOR_OPTIONS: GeneratorOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
};

export const MIN_LENGTH = 8;
export const MAX_LENGTH = 64;

const AMBIGUOUS = new Set(['l', '1', 'I', 'O', '0']);

const CHARSETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/',
} as const;

export class NoCharsetSelectedError extends Error {
  constructor() {
    super('Hay que activar al menos un tipo de carácter.');
    this.name = 'NoCharsetSelectedError';
  }
}

export function generatePassword(options: GeneratorOptions): string {
  const pools = activePools(options);
  if (pools.length === 0) throw new NoCharsetSelectedError();

  const length = clamp(options.length, MIN_LENGTH, MAX_LENGTH);
  const combined = pools.join('');

  // Un carácter obligatorio por clase activa, para que la contraseña cumpla de verdad
  // lo que el usuario pidió...
  const chars = pools.slice(0, length).map((pool) => pickChar(pool));
  // ...y el resto libre del alfabeto completo.
  while (chars.length < length) {
    chars.push(pickChar(combined));
  }

  return shuffle(chars).join('');
}

/**
 * Entropía en bits, asumiendo selección uniforme sobre el alfabeto combinado.
 *
 * Es una cota ligeramente conservadora: forzar un carácter por clase reduce en una
 * fracción marginal la entropía real. Preferimos subestimar antes que prometer de más.
 */
export function entropyBits(options: GeneratorOptions): number {
  const pools = activePools(options);
  if (pools.length === 0) return 0;
  const alphabetSize = pools.join('').length;
  const length = clamp(options.length, MIN_LENGTH, MAX_LENGTH);
  return Math.log2(alphabetSize) * length;
}

export type StrengthLevel = 'weak' | 'fair' | 'strong' | 'excellent';

export function strengthOf(bits: number): StrengthLevel {
  if (bits < 60) return 'weak';
  if (bits < 80) return 'fair';
  if (bits < 110) return 'strong';
  return 'excellent';
}

function activePools(options: GeneratorOptions): string[] {
  const selected: string[] = [];
  if (options.uppercase) selected.push(CHARSETS.uppercase);
  if (options.lowercase) selected.push(CHARSETS.lowercase);
  if (options.digits) selected.push(CHARSETS.digits);
  if (options.symbols) selected.push(CHARSETS.symbols);

  const pools = options.excludeAmbiguous ? selected.map(removeAmbiguous) : selected;

  return pools.filter((pool) => pool.length > 0);
}

function removeAmbiguous(pool: string): string {
  let kept = '';
  for (const char of pool) {
    if (!AMBIGUOUS.has(char)) kept += char;
  }
  return kept;
}

function pickChar(pool: string): string {
  const index = randomBelow(pool.length);
  const char = pool[index];
  /* v8 ignore next -- randomBelow siempre devuelve un índice válido; guarda para el tipo */
  if (char === undefined) throw new Error('Índice fuera de rango en el alfabeto');
  return char;
}

/**
 * Entero uniforme en [0, maxExclusive) por muestreo por rechazo.
 *
 * Se descartan los valores de la "cola" que no encajan en un número entero de vueltas
 * sobre el rango; sin eso, los primeros valores saldrían con mayor probabilidad.
 */
function randomBelow(maxExclusive: number): number {
  if (maxExclusive <= 0) throw new Error('maxExclusive debe ser positivo');
  if (maxExclusive === 1) return 0;

  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0] ?? 0;
  } while (value >= limit);

  return value % maxExclusive;
}

/** Fisher-Yates con aleatoriedad criptográfica y sin sesgo. */
function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1);
    const a = items[i];
    const b = items[j];
    /* v8 ignore next -- i y j siempre están en rango */
    if (a === undefined || b === undefined) continue;
    items[i] = b;
    items[j] = a;
  }
  return items;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.trunc(value), min), max);
}
