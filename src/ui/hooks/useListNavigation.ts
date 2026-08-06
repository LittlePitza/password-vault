import { useCallback, useRef } from 'react';

/**
 * Navegación con flechas por la lista.
 *
 * Mover la selección **es** mover el foco, en vez de mantener un índice seleccionado
 * aparte. Así no hay dos nociones de «dónde estoy» que puedan discrepar, `Enter` funciona
 * solo porque las filas son botones de verdad, y un lector de pantalla anuncia la fila al
 * llegar a ella sin que haya que decírselo.
 */
export function useListNavigation() {
  const listRef = useRef<HTMLUListElement>(null);

  const rows = useCallback(
    (): HTMLButtonElement[] =>
      Array.from(listRef.current?.querySelectorAll('button[data-row]') ?? []),
    [],
  );

  /** Lleva el foco a la primera fila. Es lo que hace la flecha abajo desde el buscador. */
  const focusFirst = useCallback(() => {
    rows()[0]?.focus();
  }, [rows]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

      const all = rows();
      const current = all.indexOf(document.activeElement as HTMLButtonElement);
      if (current === -1) return;

      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      // Sin dar la vuelta: llegar al final y reaparecer arriba desorienta más de lo que
      // ahorra. Al llegar al tope, el foco simplemente se queda.
      all[Math.min(Math.max(current + step, 0), all.length - 1)]?.focus();
    },
    [rows],
  );

  return { listRef, focusFirst, onKeyDown };
}
