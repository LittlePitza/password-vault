import { useId } from 'react';
import { Search, X } from 'lucide-react';

interface SearchFieldProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** La flecha abajo salta del buscador al primer resultado. */
  readonly onArrowDown: () => void;
  readonly resultCount: number;
}

/**
 * Buscador de la bóveda.
 *
 * Lleva etiqueta real aunque no se vea: el placeholder no es una etiqueta, desaparece en
 * cuanto escribes y un lector de pantalla se queda sin nada que anunciar.
 *
 * El número de resultados se anuncia por `aria-live`: quien no ve la lista filtrarse
 * necesita saber que la búsqueda hizo algo.
 */
export function SearchField({ value, onChange, onArrowDown, resultCount }: SearchFieldProps) {
  const id = useId();

  return (
    <div className="group relative">
      <label htmlFor={id} className="sr-only">
        Buscar en la bóveda
      </label>

      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-dim transition-colors duration-150 group-focus-within:text-accent"
        aria-hidden
      />

      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            onArrowDown();
          }
          if (event.key === 'Escape' && value.length > 0) {
            event.preventDefault();
            onChange('');
          }
        }}
        placeholder="Buscar…"
        autoFocus
        autoComplete="off"
        spellCheck={false}
        /*
         * `[&::-webkit-search-cancel-button]:hidden`: el `type="search"` de Chrome trae su
         * propia cruz de limpiar, gris y sin `aria-label`. Al lado de la nuestra quedaban
         * dos, y la del navegador era la que no se podía usar con teclado.
         */
        /*
         * Más alto y más redondeado que cualquier otro campo, y a propósito: es lo primero
         * que recibe el foco al abrir el popup y el gesto que se repite todos los días.
         * Un buscador con el mismo peso visual que un campo de formulario cualquiera no
         * dice que la interfaz va de buscar.
         */
        className="w-full rounded-xl border border-field bg-surface py-3 pr-10 pl-10 text-sm shadow-e1 transition-[border-color,box-shadow] duration-150 ease-out-quad outline-none placeholder:text-dim/60 focus:border-accent focus:shadow-e2 [&::-webkit-search-cancel-button]:hidden"
      />

      {value.length > 0 && (
        <button
          type="button"
          onClick={() => {
            onChange('');
          }}
          aria-label="Limpiar búsqueda"
          className="press absolute top-1/2 right-2 inline-flex size-8 -translate-y-1/2 animate-pop-in cursor-pointer items-center justify-center rounded-lg text-dim transition-[color,scale] duration-150 ease-out-quad hover:text-accent"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}

      <p aria-live="polite" className="sr-only">
        {value.length === 0 ? '' : `${String(resultCount)} resultado(s)`}
      </p>
    </div>
  );
}
