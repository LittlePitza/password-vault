import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GENERATOR_OPTIONS,
  type GeneratorOptions,
  MAX_LENGTH,
  MIN_LENGTH,
  NoCharsetSelectedError,
  entropyBits,
  generatePassword,
  strengthOf,
} from '@/src/core/generator/generator';

const options = (overrides: Partial<GeneratorOptions> = {}): GeneratorOptions => ({
  ...DEFAULT_GENERATOR_OPTIONS,
  ...overrides,
});

describe('generador de contraseñas', () => {
  it('respeta la longitud pedida', () => {
    for (const length of [MIN_LENGTH, 16, 32, MAX_LENGTH]) {
      expect(generatePassword(options({ length }))).toHaveLength(length);
    }
  });

  it('acota longitudes fuera de rango en vez de fallar', () => {
    expect(generatePassword(options({ length: 1 }))).toHaveLength(MIN_LENGTH);
    expect(generatePassword(options({ length: 500 }))).toHaveLength(MAX_LENGTH);
  });

  it('usa sólo los alfabetos activados', () => {
    const digitsOnly = generatePassword(
      options({ uppercase: false, lowercase: false, symbols: false, length: 32 }),
    );
    expect(digitsOnly).toMatch(/^\d{32}$/);
  });

  it('garantiza al menos un carácter de cada clase pedida', () => {
    // Con longitud mínima y las cuatro clases activas es donde más fácil fallaría
    // un generador ingenuo. Se repite porque es una propiedad probabilística.
    for (let i = 0; i < 200; i++) {
      const password = generatePassword(options({ length: MIN_LENGTH }));
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/\d/);
      expect(password).toMatch(/[!@#$%^&*()\-_=+[\]{};:,.?/]/);
    }
  });

  it('excluye los caracteres ambiguos cuando se pide', () => {
    for (let i = 0; i < 100; i++) {
      expect(generatePassword(options({ excludeAmbiguous: true, length: 64 }))).not.toMatch(
        /[l1IO0]/,
      );
    }
  });

  it('lanza si no hay ningún alfabeto activo', () => {
    expect(() =>
      generatePassword(
        options({ uppercase: false, lowercase: false, digits: false, symbols: false }),
      ),
    ).toThrow(NoCharsetSelectedError);
  });

  it('no repite la misma contraseña', () => {
    const generated = new Set(Array.from({ length: 500 }, () => generatePassword(options())));
    expect(generated.size).toBe(500);
  });

  it('distribuye los caracteres sin sesgo apreciable', () => {
    // Muestreo por rechazo: con 10 símbolos sobre 2^32 el sesgo debe ser indetectable.
    // Un `% length` ingenuo sobre un alfabeto que no divide a la potencia de dos se
    // desviaría de forma sistemática, no aleatoria.
    const counts = new Map<string, number>();
    const samples = 20_000;
    for (let i = 0; i < samples / 20; i++) {
      for (const char of generatePassword(
        options({ uppercase: false, lowercase: false, symbols: false, length: 20 }),
      )) {
        counts.set(char, (counts.get(char) ?? 0) + 1);
      }
    }

    const expected = samples / 10;
    for (const digit of '0123456789') {
      const observed = counts.get(digit) ?? 0;
      expect(Math.abs(observed - expected) / expected).toBeLessThan(0.15);
    }
  });
});

describe('entropía', () => {
  it('crece con la longitud y con el tamaño del alfabeto', () => {
    const corta = entropyBits(options({ length: 8 }));
    const larga = entropyBits(options({ length: 32 }));
    const soloDigitos = entropyBits(
      options({ length: 32, uppercase: false, lowercase: false, symbols: false }),
    );

    expect(larga).toBeGreaterThan(corta);
    expect(larga).toBeGreaterThan(soloDigitos);
  });

  it('vale 0 si no hay alfabeto', () => {
    expect(
      entropyBits(options({ uppercase: false, lowercase: false, digits: false, symbols: false })),
    ).toBe(0);
  });

  it('clasifica la fuerza en escalones coherentes', () => {
    expect(strengthOf(40)).toBe('weak');
    expect(strengthOf(70)).toBe('fair');
    expect(strengthOf(100)).toBe('strong');
    expect(strengthOf(128)).toBe('excellent');
  });

  it('la configuración por defecto produce una contraseña fuerte', () => {
    expect(strengthOf(entropyBits(DEFAULT_GENERATOR_OPTIONS))).toBe('excellent');
  });
});
