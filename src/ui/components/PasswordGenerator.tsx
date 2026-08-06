import { useId, useState } from 'react';
import type { CSSProperties } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  DEFAULT_GENERATOR_OPTIONS,
  type GeneratorOptions,
  MAX_LENGTH,
  MIN_LENGTH,
  entropyBits,
  generatePassword,
  strengthOf,
} from '@/src/core/generator/generator';

interface PasswordGeneratorProps {
  readonly onGenerate: (password: string) => void;
}

const TOGGLES: readonly {
  readonly key: keyof Omit<GeneratorOptions, 'length'>;
  readonly label: string;
}[] = [
  { key: 'uppercase', label: 'ABC' },
  { key: 'lowercase', label: 'abc' },
  { key: 'digits', label: '123' },
  { key: 'symbols', label: '#$&' },
  { key: 'excludeAmbiguous', label: 'Sin l1IO0' },
];

const STRENGTH_TONE = {
  weak: 'text-danger',
  fair: 'text-warn',
  strong: 'text-ok',
  excellent: 'text-ok',
} as const;

/**
 * Generador embebido en el formulario de credenciales.
 *
 * La entropía se muestra en bits y no como «fuerte / débil» a secas: es el único número
 * que dice algo real, y ver cómo sube al alargar la contraseña enseña más que cualquier
 * texto de ayuda.
 *
 * Desactivar todas las clases dejaría al generador sin alfabeto. En vez de dejar que
 * lance la excepción, el botón se deshabilita: un error que el usuario no puede provocar
 * es un error que no hay que explicar.
 */
export function PasswordGenerator({ onGenerate }: PasswordGeneratorProps) {
  const [options, setOptions] = useState<GeneratorOptions>(DEFAULT_GENERATOR_OPTIONS);
  /**
   * Cuántas veces se ha pulsado generar.
   *
   * Sirve de `key` del icono: al cambiar, React monta uno nuevo y la vuelta se reproduce
   * otra vez. Sin esto, la segunda pulsación no giraría nada — la animación ya habría
   * terminado sobre el mismo elemento— y generar dos contraseñas seguidas no daría ningún
   * acuse, porque el campo de arriba cambia fuera de la vista.
   */
  const [generations, setGenerations] = useState(0);
  const lengthId = useId();

  const bits = entropyBits(options);
  const usable = bits > 0;
  const progress = ((options.length - MIN_LENGTH) / (MAX_LENGTH - MIN_LENGTH)) * 100;

  return (
    <div className="surface-card flex animate-view-in flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <label htmlFor={lengthId} className="text-xs font-medium text-dim">
          Longitud: <span className="text-text">{options.length}</span>
        </label>
        <span
          className={`text-xs font-medium transition-colors duration-300 ${usable ? STRENGTH_TONE[strengthOf(bits)] : 'text-danger'}`}
        >
          {usable ? `${String(Math.round(bits))} bits` : 'Elige un tipo'}
        </span>
      </div>

      <input
        id={lengthId}
        type="range"
        min={MIN_LENGTH}
        max={MAX_LENGTH}
        value={options.length}
        onChange={(event) => {
          setOptions((current) => ({ ...current, length: Number(event.target.value) }));
        }}
        /*
         * El relleno del carril se pinta con un degradado que corta justo en el valor
         * actual, y ese corte llega por variable. Es la única forma de teñir la parte
         * recorrida de un `input[type=range]` sin montar un deslizador propio a base de
         * divs, que costaría toda la accesibilidad que este trae de fábrica.
         *
         * El cast es el modo estándar de pasar una propiedad personalizada por `style`:
         * los tipos de React sólo declaran las propiedades CSS conocidas.
         */
        style={{ '--range-progress': `${String(progress)}%` } as CSSProperties}
        className="range"
      />

      <div className="flex flex-wrap gap-1">
        {TOGGLES.map(({ key, label }) => {
          const active = options[key];

          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setOptions((current) => ({ ...current, [key]: !current[key] }));
              }}
              className={`press cursor-pointer rounded-lg px-2 py-1 font-mono text-xs transition-[background-color,color,box-shadow,scale] duration-150 ease-out-quad ${
                active
                  ? 'bg-accent text-on-accent shadow-e1'
                  : 'bg-bg text-dim hover:text-text ring-1 ring-border ring-inset'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!usable}
        onClick={() => {
          onGenerate(generatePassword(options));
          setGenerations((count) => count + 1);
        }}
        className="press flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-on-accent shadow-e1 transition-[background-color,box-shadow,color,scale] duration-150 ease-out-quad hover:bg-accent-hover hover:shadow-glow disabled:cursor-not-allowed disabled:bg-border disabled:text-dim disabled:shadow-none"
      >
        <RefreshCw
          key={generations}
          className={`size-3.5 ${generations > 0 ? 'animate-spin-once' : ''}`}
          aria-hidden
        />
        Generar contraseña
      </button>
    </div>
  );
}
