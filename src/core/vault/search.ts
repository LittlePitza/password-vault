import type { ItemSummary, ItemType } from '../model/item';

/**
 * Búsqueda y ordenación de la lista de la bóveda.
 *
 * Vive en el núcleo y es una función pura: entra un array, sale otro. Eso permite probar
 * el comportamiento de relevancia — que es donde de verdad se nota si la búsqueda es buena
 * o mala — sin montar un solo componente.
 *
 * Sólo se busca sobre `ItemSummary`, nunca sobre el item completo. El resumen contiene
 * título y una línea identificativa (usuario, «Nota segura», los cuatro últimos dígitos);
 * las contraseñas no entran aquí ni por accidente.
 */

export type TypeFilter = 'all' | ItemType;

export interface SearchOptions {
  readonly query: string;
  readonly type: TypeFilter;
}

/**
 * Pasa el texto a una forma comparable: minúsculas y sin diacríticos.
 *
 * Buscar «contrasena» tiene que encontrar «Contraseña», y «brasil» tiene que encontrar
 * «Brasîl». Quien busca en un gestor de contraseñas escribe rápido y sin acentos.
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Divide la consulta en términos. Todos deben aparecer para que el item cuente. */
function termsOf(query: string): readonly string[] {
  const normalized = normalizeForSearch(query);
  return normalized.length === 0 ? [] : normalized.split(/\s+/);
}

/**
 * Puntuación de un término contra un item.
 *
 * La escala premia dónde aparece la coincidencia, no cuántas veces: en una lista de
 * credenciales lo que discrimina es si escribiste el principio del nombre del sitio.
 * Devuelve 0 si no aparece en ninguna parte.
 */
function scoreTerm(term: string, title: string, subtitle: string): number {
  if (title.startsWith(term)) return 100;
  if (startsAnyWord(title, term)) return 80;
  if (title.includes(term)) return 60;
  if (subtitle.startsWith(term)) return 40;
  if (subtitle.includes(term)) return 20;
  return 0;
}

/** ¿Alguna palabra del texto empieza por el término? «com» encuentra «github.com». */
function startsAnyWord(text: string, term: string): boolean {
  return text.split(/[^\p{L}\p{N}]+/u).some((word) => word.startsWith(term));
}

function scoreItem(terms: readonly string[], item: ItemSummary): number {
  const title = normalizeForSearch(item.title);
  const subtitle = normalizeForSearch(item.subtitle);

  let total = 0;
  for (const term of terms) {
    const score = scoreTerm(term, title, subtitle);
    // Todos los términos son obligatorios: «github juan» no debe devolver items que sólo
    // coincidan con uno de los dos.
    if (score === 0) return 0;
    total += score;
  }
  return total;
}

/**
 * Filtra por tipo y por texto, y ordena por relevancia.
 *
 * ── Sobre los favoritos ───────────────────────────────────────────────────────
 * Con la búsqueda vacía los favoritos van primero: se está ojeando la lista y ése es su
 * sentido. Pero **al buscar, la relevancia manda** y el favorito sólo desempata. Si no
 * fuera así, escribir el nombre exacto de un sitio podría devolver primero un favorito
 * que coincide peor, y eso se siente roto.
 */
export function searchItems(
  items: readonly ItemSummary[],
  { query, type }: SearchOptions,
): readonly ItemSummary[] {
  const terms = termsOf(query);
  const browsing = terms.length === 0;

  const scored: { item: ItemSummary; score: number }[] = [];
  for (const item of items) {
    if (type !== 'all' && item.type !== type) continue;

    const score = browsing ? 0 : scoreItem(terms, item);
    if (browsing || score > 0) scored.push({ item, score });
  }

  scored.sort((a, b) => {
    if (!browsing && a.score !== b.score) return b.score - a.score;
    if (a.item.favorite !== b.item.favorite) return a.item.favorite ? -1 : 1;
    if (a.item.updatedAt !== b.item.updatedAt) return b.item.updatedAt - a.item.updatedAt;
    return a.item.title.localeCompare(b.item.title, 'es');
  });

  return scored.map((entry) => entry.item);
}

/** Cuántos items hay de cada tipo, para las pestañas del filtro. */
export function countByType(items: readonly ItemSummary[]): Readonly<Record<TypeFilter, number>> {
  const counts = { all: items.length, login: 0, note: 0, card: 0 };
  for (const item of items) counts[item.type] += 1;
  return counts;
}
