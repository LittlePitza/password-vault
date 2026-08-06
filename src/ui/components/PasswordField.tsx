import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly autoFocus?: boolean;
  readonly autoComplete?: string;
  readonly describedBy?: string;
}

export function PasswordField({
  label,
  value,
  onChange,
  autoFocus = false,
  autoComplete = 'current-password',
  describedBy,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div className="group flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-xs font-medium text-dim transition-colors duration-150 group-focus-within:text-accent"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          aria-describedby={describedBy}
          /*
           * `tracking-wide` sólo cuando está oculta: los puntos del enmascarado se apelmazan
           * y a simple vista no se distingue una contraseña de 10 caracteres de una de 14.
           * Con la contraseña visible el espaciado extra estorbaría al leerla.
           */
          className={`w-full rounded-lg border border-field bg-surface px-3 py-2.5 pr-11 font-mono text-sm text-text transition-[border-color,letter-spacing] duration-150 ease-out-quad outline-none focus:border-accent ${
            visible ? '' : 'tracking-wide'
          }`}
        />

        <button
          type="button"
          onClick={() => {
            setVisible((shown) => !shown);
          }}
          // El estado va en el texto accesible, no sólo en el icono: un lector de
          // pantalla no puede interpretar el ojo tachado.
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          className="press absolute top-1/2 right-1.5 inline-flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-dim transition-[color,scale] duration-150 ease-out-quad hover:text-accent"
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden />
          ) : (
            <Eye className="size-4" aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}
