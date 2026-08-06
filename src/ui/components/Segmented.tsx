interface SegmentedOption<T extends string> {
  readonly key: T;
  readonly label: string;
  /** Número al lado de la etiqueta. Sólo donde contar significa algo. */
  readonly badge?: number;
}

interface SegmentedProps<T extends string> {
  /** Va al `aria-label` del grupo: sin él son cuatro botones sueltos sin relación. */
  readonly label: string;
  readonly options: readonly SegmentedOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}

/**
 * Selector de una opción entre pocas.
 *
 * ── Por qué botones y no un `tablist` ─────────────────────────────────────────
 * No navegan a paneles distintos: cambian un filtro o un tipo sobre la misma superficie.
 * El rol de pestañas obligaría además a que las flechas se movieran entre ellas, y en la
 * pantalla principal ese gesto ya está adjudicado a la lista, que es donde de verdad hace
 * falta.
 *
 * ── Por qué una pastilla que se mueve ─────────────────────────────────────────
 * La alternativa es encender el fondo del botón nuevo y apagar el del viejo, y deja al ojo
 * buscando qué ha cambiado. Un elemento único que se desplaza explica el cambio: de aquí,
 * a aquí. Es un `translateX` de su propia anchura, así que corre en el compositor y no
 * recalcula la disposición de nada.
 *
 * La pastilla es `aria-hidden` porque es decoración. Lo que un lector de pantalla anuncia
 * es `aria-pressed`, que dice lo mismo sin depender de verlo.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  const activeIndex = options.findIndex((option) => option.key === value);

  return (
    <div
      className="relative flex rounded-xl border border-border bg-surface p-1 shadow-e1"
      role="group"
      aria-label={label}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-lg bg-accent shadow-e1 transition-transform duration-300 ease-out-expo"
        style={{
          // La pista útil es el ancho del contenedor menos sus 4 px de relleno a cada lado.
          width: `calc((100% - 0.5rem) / ${String(options.length)})`,
          transform: `translateX(${String(activeIndex * 100)}%)`,
        }}
      />

      {options.map(({ key, label: optionLabel, badge }) => {
        const active = key === value;

        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => {
              onChange(key);
            }}
            className={`relative z-10 flex-1 cursor-pointer rounded-lg px-1 py-1.5 text-xs font-medium transition-colors duration-200 ease-out-quad ${
              active ? 'text-on-accent' : 'text-dim hover:text-text'
            }`}
          >
            {optionLabel}
            {badge !== undefined && (
              <span className={active ? 'opacity-70' : 'opacity-60'}> {badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
