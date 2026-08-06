import type { LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
  /** Siempre hay una salida: un hueco en blanco sin acción es un callejón. */
  readonly action: { readonly label: string; readonly onClick: () => void };
}

/**
 * Pantalla vacía.
 *
 * La bóveda sin items y la búsqueda sin resultados son situaciones distintas y se muestran
 * distinto: la primera invita a crear el primer item, la segunda a limpiar la búsqueda.
 * Lo que no hacen ninguna de las dos es enseñar un «0 resultados» y dejar ahí al usuario.
 *
 * Los tres bloques entran escalonados. Es la misma cascada que la lista, y es a propósito:
 * una bóveda vacía y una bóveda con resultados aparecen igual, así que el hueco se lee
 * como una respuesta y no como algo que no ha terminado de cargar.
 */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-12 text-center">
      <span className="mb-1 inline-flex animate-pop-in items-center justify-center rounded-2xl bg-surface p-3.5 text-dim shadow-e1 ring-1 ring-border ring-inset">
        <Icon className="size-7" aria-hidden />
      </span>
      <p className="animate-rise-in text-sm font-medium text-text [animation-delay:60ms]">
        {title}
      </p>
      <p className="animate-rise-in text-xs text-dim [animation-delay:120ms]">{description}</p>
      <Button
        variant="secondary"
        onClick={action.onClick}
        className="mt-1 animate-rise-in [animation-delay:180ms]"
      >
        {action.label}
      </Button>
    </div>
  );
}
