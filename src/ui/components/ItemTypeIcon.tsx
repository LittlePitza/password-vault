import { CreditCard, KeyRound, StickyNote } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ItemType } from '@/src/core/model/item';

/**
 * Distintivo del tipo de item.
 *
 * Icono **y** color, nunca sólo color: es uno de los anti-patrones marcados en el sistema
 * de diseño. Quien no distinga el verde del azul tiene que poder separar una tarjeta de
 * una nota igual de rápido, y para eso está la forma.
 *
 * El nombre del tipo va además en texto para lectores de pantalla, que no ven ninguna
 * de las dos cosas.
 *
 * El aro de `ring-<tipo>/15` es lo que le da cuerpo: un cuadrado de color plano se lee
 * como un hueco, y con el filo se lee como una ficha apoyada encima.
 */

/** Se exporta porque el selector de tipo del formulario dibuja los mismos glifos a más
 * tamaño. Repetir el mapa allí sería la forma de que un día una nota saliera con la llave. */
export const TYPE_ICONS: Readonly<Record<ItemType, LucideIcon>> = {
  login: KeyRound,
  note: StickyNote,
  card: CreditCard,
};

const TONES: Readonly<Record<ItemType, string>> = {
  login: 'bg-login/10 text-login ring-login/15',
  note: 'bg-note/10 text-note ring-note/15',
  card: 'bg-card/10 text-card ring-card/15',
};

export const TYPE_LABELS: Readonly<Record<ItemType, string>> = {
  login: 'Credencial',
  note: 'Nota segura',
  card: 'Tarjeta',
};

interface ItemTypeIconProps {
  readonly type: ItemType;
  /**
   * `lg` es la ficha de 40 px de la lista y de la cabecera del detalle.
   *
   * En una lista sin líneas divisorias, la ficha es lo que marca dónde empieza cada fila:
   * a 32 px se queda por debajo de la altura del bloque de texto y las filas se funden. A
   * 40 px lo ancla, y de paso el icono cabe a 20 px y se distingue de un vistazo.
   */
  readonly size?: 'md' | 'lg';
}

const SIZES = {
  md: { box: 'size-8 rounded-lg', glyph: 'size-4' },
  lg: { box: 'size-10 rounded-xl', glyph: 'size-5' },
} as const;

export function ItemTypeIcon({ type, size = 'md' }: ItemTypeIconProps) {
  const Icon = TYPE_ICONS[type];
  const scale = SIZES[size];

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ring-1 ring-inset ${scale.box} ${TONES[type]}`}
    >
      <Icon className={scale.glyph} aria-hidden />
      <span className="sr-only">{TYPE_LABELS[type]}</span>
    </span>
  );
}
