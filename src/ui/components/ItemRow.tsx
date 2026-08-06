import { KeyRound, Star, User } from 'lucide-react';
import type { ItemSummary } from '@/src/core/model/item';
import { IconButton } from './IconButton';
import { ItemTypeIcon } from './ItemTypeIcon';

interface ItemRowProps {
  readonly item: ItemSummary;
  /** Posición en la lista, para escalonar la entrada. */
  readonly index: number;
  readonly onOpen: () => void;
  /** Sólo en credenciales: copiar sin abrir el detalle es el gesto más frecuente. */
  readonly onCopyUsername?: () => void;
  readonly onCopyPassword?: () => void;
}

/** Tope del escalonado: a partir de aquí las filas entran a la vez. */
const MAX_STAGGERED = 10;

/**
 * Fila de la lista, 56 px.
 *
 * ── Por qué los botones de copiar están siempre visibles ──────────────────────
 * Lo habitual sería revelarlos al pasar el ratón. Es un anti-patrón: en un portátil táctil
 * o con el teclado no hay hover, y la acción queda inaccesible. Aquí se ven siempre en
 * `text-dim` y el hover sólo los realza.
 *
 * ── Por qué la fila no es un único botón ──────────────────────────────────────
 * Anidar botones no es HTML válido. La zona de texto es el botón que abre el item y las
 * acciones son hermanas suyas, así que el orden de tabulación queda: fila, copiar usuario,
 * copiar contraseña, siguiente fila.
 *
 * ── Por qué la fila no crece al pasar por encima ──────────────────────────────
 * El realce es un fondo elevado y nada más. Sin `scale`: escalar una fila de una lista
 * desplaza a las de debajo, y recorrerla con el ratón se convierte en un temblor.
 *
 * El realce responde también a `focus-within`, no sólo a `hover`: quien recorre la lista
 * con las flechas tiene que ver dónde está igual de claro que quien usa el ratón.
 *
 * ── Por qué no hay línea divisoria ────────────────────────────────────────────
 * Las filas se separan por espacio y por la ficha de icono, que a 40 px ancla cada bloque.
 * Una lista de cuatro elementos con tres líneas horizontales tiene más tinta dedicada a
 * separar que a informar. La línea sólo hace falta cuando las filas son tan bajas que se
 * tocan, y aquí no lo son.
 */
export function ItemRow({ item, index, onOpen, onCopyUsername, onCopyPassword }: ItemRowProps) {
  return (
    <li
      className="group/row relative flex animate-row-in items-center gap-1 rounded-xl transition-colors duration-150 ease-out-quad hover:bg-elevated focus-within:bg-elevated"
      style={{ animationDelay: `${String(Math.min(index, MAX_STAGGERED) * 30)}ms` }}
    >
      <button
        type="button"
        data-row
        onClick={onOpen}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-left"
      >
        <ItemTypeIcon type={item.type} size="lg" />

        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            {item.favorite && (
              <Star className="size-3 shrink-0 fill-current text-accent" aria-label="Favorito" />
            )}
            <span className="truncate text-sm font-medium text-text">{item.title}</span>
          </span>
          {/* Identifica el item sin revelar nada: usuario, «Nota segura» o los cuatro
              últimos dígitos. Nunca la contraseña. */}
          <span className="truncate text-xs text-dim">{item.subtitle}</span>
        </span>
      </button>

      {/*
        Ancho fijo aunque el item no tenga acciones: así los títulos de todas las filas se
        cortan a la misma altura y la lista no baila al filtrar por tipo. Es un hueco
        vacío, no un botón invisible — un botón sin contenido sería una parada de
        tabulación que no lleva a ninguna parte.
      */}
      <div className="flex w-[72px] shrink-0 items-center justify-end gap-2 pr-1">
        {onCopyUsername !== undefined && (
          <IconButton label={`Copiar usuario de ${item.title}`} onClick={onCopyUsername}>
            <User className="size-4" aria-hidden />
          </IconButton>
        )}

        {onCopyPassword !== undefined && (
          <IconButton label={`Copiar contraseña de ${item.title}`} onClick={onCopyPassword}>
            <KeyRound className="size-4" aria-hidden />
          </IconButton>
        )}
      </div>
    </li>
  );
}
