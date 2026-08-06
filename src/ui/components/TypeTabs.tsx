import type { TypeFilter } from '@/src/core/vault/search';
import { Segmented } from './Segmented';

interface TypeTabsProps {
  readonly value: TypeFilter;
  readonly onChange: (value: TypeFilter) => void;
  readonly counts: Readonly<Record<TypeFilter, number>>;
}

const OPTIONS: readonly { readonly key: TypeFilter; readonly label: string }[] = [
  { key: 'all', label: 'Todo' },
  { key: 'login', label: 'Logins' },
  { key: 'note', label: 'Notas' },
  { key: 'card', label: 'Tarjetas' },
];

/**
 * Filtro por tipo de la pantalla principal.
 *
 * Lo único que aporta sobre `Segmented` es el contador de cada tipo, y va dentro del botón
 * a propósito: un filtro que deja la lista vacía debería poder anticiparse antes de
 * pulsarlo.
 */
export function TypeTabs({ value, onChange, counts }: TypeTabsProps) {
  return (
    <Segmented
      label="Filtrar por tipo"
      value={value}
      onChange={onChange}
      options={OPTIONS.map(({ key, label }) => ({ key, label, badge: counts[key] }))}
    />
  );
}
