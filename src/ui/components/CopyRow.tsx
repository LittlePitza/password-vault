import { useState } from 'react';
import { Copy, Eye, EyeOff } from 'lucide-react';
import { IconButton } from './IconButton';

interface CopyRowProps {
  readonly label: string;
  readonly value: string;
  /** Si es secreto se muestra enmascarado hasta que se pida verlo. */
  readonly secret?: boolean;
  readonly onCopy: () => void;
}

/**
 * Una línea del detalle: etiqueta, valor y botón de copiar.
 *
 * Copiar **no** exige revelar antes. Son dos necesidades distintas —pegar en un formulario
 * frente a leer en voz alta o teclear en el móvil— y la frecuente es copiar. Obligar a
 * enseñar la contraseña en pantalla para poder copiarla sería empeorar la seguridad a
 * cambio de nada.
 */
export function CopyRow({ label, value, secret = false, onCopy }: CopyRowProps) {
  const [revealed, setRevealed] = useState(false);
  const hidden = secret && !revealed;

  return (
    <div className="-mx-2 flex items-center gap-1 rounded-lg border-b border-border/60 px-2 py-2 transition-colors duration-150 ease-out-quad last:border-0 hover:bg-surface focus-within:bg-surface">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs text-dim">{label}</span>
        <span
          className={`truncate text-sm text-text ${secret ? 'font-mono' : ''} ${
            /*
             * El enmascarado se separa a propósito: doce puntos apretados parecen ocho.
             * Con el valor a la vista el espaciado extra sólo estorbaría al leerlo.
             */
            hidden ? 'tracking-[0.2em]' : ''
          }`}
          // El valor enmascarado se anuncia como oculto en vez de leerse como una ristra
          // de puntos.
          aria-label={hidden ? `${label} oculta` : undefined}
        >
          {hidden ? '••••••••••••' : value}
        </span>
      </div>

      {secret && (
        <IconButton
          label={revealed ? `Ocultar ${label}` : `Mostrar ${label}`}
          aria-pressed={revealed}
          onClick={() => {
            setRevealed((shown) => !shown);
          }}
        >
          {revealed ? (
            <EyeOff className="size-4" aria-hidden />
          ) : (
            <Eye className="size-4" aria-hidden />
          )}
        </IconButton>
      )}

      <IconButton label={`Copiar ${label}`} onClick={onCopy}>
        <Copy className="size-4" aria-hidden />
      </IconButton>
    </div>
  );
}
