import { describe, expect, it } from 'vitest';
import { countByType, normalizeForSearch, searchItems } from '@/src/core/vault/search';
import type { ItemSummary } from '@/src/core/model/item';

function summary(partial: Partial<ItemSummary> & Pick<ItemSummary, 'title'>): ItemSummary {
  return {
    id: partial.title,
    type: 'login',
    favorite: false,
    updatedAt: 1_000,
    subtitle: '',
    ...partial,
  };
}

const titlesOf = (items: readonly ItemSummary[]) => items.map((item) => item.title);

describe('normalización de la consulta', () => {
  it('ignora mayúsculas y acentos en ambos sentidos', () => {
    expect(normalizeForSearch('  Contraseña DEL Router  ')).toBe('contrasena del router');
    expect(normalizeForSearch('BRASÎL')).toBe(normalizeForSearch('brasil'));
  });
});

describe('relevancia', () => {
  const items = [
    summary({ title: 'Mi cuenta de GitHub', subtitle: 'ana@correo.com' }),
    summary({ title: 'GitHub', subtitle: 'ana@correo.com' }),
    summary({ title: 'Gitlab corporativo', subtitle: 'github-mirror' }),
  ];

  it('el título que empieza por el término gana al que sólo lo contiene', () => {
    expect(titlesOf(searchItems(items, { query: 'github', type: 'all' }))).toEqual([
      'GitHub',
      'Mi cuenta de GitHub',
      'Gitlab corporativo',
    ]);
  });

  it('una palabra interior del título pesa más que el subtítulo', () => {
    const result = searchItems(
      [
        summary({ title: 'Correo', subtitle: 'banco-santander' }),
        summary({ title: 'Cuenta banco', subtitle: 'ana' }),
      ],
      { query: 'banco', type: 'all' },
    );

    expect(titlesOf(result)).toEqual(['Cuenta banco', 'Correo']);
  });

  it('encuentra por una palabra que no es la primera', () => {
    // Escribir «com» debe encontrar «github.com»: la gente busca por el trozo que recuerda.
    const result = searchItems([summary({ title: 'github.com' })], { query: 'com', type: 'all' });
    expect(result).toHaveLength(1);
  });

  it('busca sin acentos lo que está guardado con ellos', () => {
    const result = searchItems([summary({ title: 'Compañía Eléctrica' })], {
      query: 'compania electrica',
      type: 'all',
    });
    expect(result).toHaveLength(1);
  });

  it('exige que aparezcan TODOS los términos', () => {
    const items = [
      summary({ title: 'GitHub', subtitle: 'ana@correo.com' }),
      summary({ title: 'GitHub trabajo', subtitle: 'juan@correo.com' }),
    ];

    expect(titlesOf(searchItems(items, { query: 'github juan', type: 'all' }))).toEqual([
      'GitHub trabajo',
    ]);
  });

  it('devuelve vacío cuando nada coincide', () => {
    expect(searchItems([summary({ title: 'GitHub' })], { query: 'zzz', type: 'all' })).toEqual([]);
  });
});

describe('favoritos', () => {
  const items = [
    summary({ title: 'Zeta', favorite: false, updatedAt: 3_000 }),
    summary({ title: 'Alfa', favorite: true, updatedAt: 1_000 }),
  ];

  it('van primero cuando se está ojeando la lista', () => {
    expect(titlesOf(searchItems(items, { query: '', type: 'all' }))).toEqual(['Alfa', 'Zeta']);
  });

  it('NO adelantan a una coincidencia mejor al buscar', () => {
    const result = searchItems(
      [
        summary({ title: 'Copia de Banco', favorite: true }),
        summary({ title: 'Banco', favorite: false }),
      ],
      { query: 'banco', type: 'all' },
    );

    // El favorito coincide peor: sale segundo. Si mandara el favorito, escribir el nombre
    // exacto devolvería otra cosa primero y la búsqueda se sentiría rota.
    expect(titlesOf(result)).toEqual(['Banco', 'Copia de Banco']);
  });

  it('desempatan entre coincidencias igual de buenas', () => {
    const result = searchItems(
      [
        summary({ title: 'Banco A', favorite: false, updatedAt: 5_000 }),
        summary({ title: 'Banco B', favorite: true, updatedAt: 1_000 }),
      ],
      { query: 'banco', type: 'all' },
    );

    expect(titlesOf(result)).toEqual(['Banco B', 'Banco A']);
  });
});

describe('filtro por tipo', () => {
  const items = [
    summary({ title: 'Login', type: 'login' }),
    summary({ title: 'Nota', type: 'note' }),
    summary({ title: 'Tarjeta', type: 'card' }),
  ];

  it('se aplica antes que el texto', () => {
    expect(titlesOf(searchItems(items, { query: '', type: 'note' }))).toEqual(['Nota']);
    expect(searchItems(items, { query: 'login', type: 'card' })).toEqual([]);
  });

  it('cuenta cada tipo para las pestañas', () => {
    expect(countByType(items)).toEqual({ all: 3, login: 1, note: 1, card: 1 });
  });

  it('cuenta cero sin items', () => {
    expect(countByType([])).toEqual({ all: 0, login: 0, note: 0, card: 0 });
  });
});

describe('orden estable', () => {
  it('a igualdad de todo, ordena por título en español', () => {
    const items = [summary({ title: 'Ñandú' }), summary({ title: 'Naranja' })];
    expect(titlesOf(searchItems(items, { query: '', type: 'all' }))).toEqual(['Naranja', 'Ñandú']);
  });

  it('lo más reciente primero cuando el resto empata', () => {
    const items = [
      summary({ title: 'Viejo', updatedAt: 1 }),
      summary({ title: 'Nuevo', updatedAt: 2 }),
    ];
    expect(titlesOf(searchItems(items, { query: '', type: 'all' }))).toEqual(['Nuevo', 'Viejo']);
  });
});
