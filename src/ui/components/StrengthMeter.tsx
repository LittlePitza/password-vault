import { describeStrength, estimatePasswordStrength } from '@/src/core/generator/strength';
import type { StrengthLevel } from '@/src/core/generator/generator';

interface StrengthMeterProps {
  readonly password: string;
  readonly id?: string;
}

/** Cuántos de los cuatro segmentos se encienden en cada nivel. */
const LIT: Record<StrengthLevel, number> = {
  weak: 1,
  fair: 2,
  strong: 3,
  excellent: 4,
};

const TONE: Record<StrengthLevel, string> = {
  weak: 'bg-danger',
  fair: 'bg-warn',
  strong: 'bg-ok',
  excellent: 'bg-ok',
};

const TEXT: Record<StrengthLevel, string> = {
  weak: 'text-danger',
  fair: 'text-warn',
  strong: 'text-ok',
  excellent: 'text-ok',
};

const SEGMENTS = [0, 1, 2, 3];

/**
 * Fuerza de la contraseña, en cuatro segmentos.
 *
 * Antes era una sola barra que crecía. Cuatro segmentos dicen lo mismo pero además
 * **cuentan**: la fuerza deja de depender sólo de que se distinga el rojo del verde, que
 * es justo el anti-patrón que el sistema de diseño prohíbe. Con dos de cuatro encendidos
 * el nivel se ve aunque no se vea el color.
 *
 * Se encienden de uno en uno con 60 ms de retraso entre ellos, así que al escribir la
 * barra sube en cascada en vez de saltar de golpe.
 */
export function StrengthMeter({ password, id }: StrengthMeterProps) {
  const { bits, level } = estimatePasswordStrength(password);
  const typed = password.length > 0;
  const lit = typed ? LIT[level] : 0;

  return (
    <div id={id} className="flex flex-col gap-1.5">
      <div
        className="flex gap-1"
        role="progressbar"
        aria-label="Fuerza de la contraseña"
        aria-valuetext={typed ? describeStrength(level) : 'Sin contraseña'}
      >
        {SEGMENTS.map((segment) => (
          <span
            key={segment}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ease-out-quad ${
              segment < lit ? TONE[level] : 'bg-border'
            }`}
            style={{ transitionDelay: `${String(segment * 60)}ms` }}
          />
        ))}
      </div>

      {typed && (
        <p className={`text-xs transition-colors duration-300 ${TEXT[level]}`}>
          {describeStrength(level)} · ~{Math.round(bits)} bits
        </p>
      )}
    </div>
  );
}
