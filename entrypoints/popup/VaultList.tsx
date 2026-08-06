import { useDeferredValue, useMemo, useState } from 'react';
import { AlertTriangle, Inbox, LifeBuoy, Lock, Plus, SearchX } from 'lucide-react';
import { send } from '@/src/messaging/client';
import type { ItemSummary } from '@/src/core/model/item';
import { type TypeFilter, countByType, searchItems } from '@/src/core/vault/search';
import { useCopyToClipboard } from '@/src/ui/hooks/useCopyToClipboard';
import { useListNavigation } from '@/src/ui/hooks/useListNavigation';
import { Button } from '@/src/ui/components/Button';
import { IconButton } from '@/src/ui/components/IconButton';
import { SearchField } from '@/src/ui/components/SearchField';
import { TypeTabs } from '@/src/ui/components/TypeTabs';
import { ItemRow } from '@/src/ui/components/ItemRow';
import { EmptyState } from '@/src/ui/components/EmptyState';
import { ThemeToggle } from '@/src/ui/components/ThemeToggle';
import { Toast } from '@/src/ui/components/Toast';

interface VaultListProps {
  readonly items: readonly ItemSummary[];
  readonly damagedCount: number;
  readonly missingRecoveryCode: boolean;
  readonly onOpen: (id: string) => void;
  readonly onCreate: () => void;
  readonly onBackup: () => void;
  readonly onLock: () => void;
}

/**
 * Pantalla principal: buscar, filtrar y copiar.
 *
 * Es la superficie del día a día, y el gesto que se repite es «abro el popup, escribo tres
 * letras, copio la contraseña». Todo lo demás está subordinado a que ese camino sea corto:
 * el buscador tiene el foco al abrir, la flecha abajo lleva a los resultados y copiar no
 * exige entrar al detalle.
 *
 * ── La estructura: marco fuera, datos dentro ──────────────────────────────────
 * El título y el buscador van directamente sobre el fondo. Todo lo demás vive en un panel
 * de esquinas redondeadas que arranca ahí y llega hasta abajo.
 *
 * No es decoración: es la jerarquía que la pantalla no tenía. Fuera está el marco —dónde
 * estás y qué buscas—, dentro están tus datos. Con todo al mismo nivel había que leer el
 * popup entero para encontrar por dónde se empieza.
 *
 * ── Por qué el título es grande ───────────────────────────────────────────────
 * Un popup se abre desde una barra de navegador llena de iconos diminutos. Entrar en una
 * superficie que empieza con una palabra grande y clara es lo que la separa de la ventana
 * que la ha lanzado. Ocupa 32 px de los 600 y los devuelve con creces.
 */
export function VaultList({
  items,
  damagedCount,
  missingRecoveryCode,
  onOpen,
  onCreate,
  onBackup,
  onLock,
}: VaultListProps) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const { feedback, copy } = useCopyToClipboard();
  const { listRef, focusFirst, onKeyDown } = useListNavigation();

  // El filtrado no bloquea al teclear. Con unos cientos de items es instantáneo de todos
  // modos, pero deja de serlo justo cuando la bóveda crece, que es cuando peor se nota.
  const deferredQuery = useDeferredValue(query);
  const visible = useMemo(
    () => searchItems(items, { query: deferredQuery, type }),
    [items, deferredQuery, type],
  );
  const counts = useMemo(() => countByType(items), [items]);

  /**
   * Copiar desde la lista sin abrir el item.
   *
   * El secreto se pide al service worker en este instante y sólo el del item pulsado: la
   * lista nunca ha tenido las contraseñas en memoria y no va a empezar ahora.
   */
  async function copyField(item: ItemSummary, field: 'username' | 'password'): Promise<void> {
    const response = await send({ type: 'vault/reveal', id: item.id });
    if (!response.ok || response.value.type !== 'login') return;

    const label = field === 'username' ? 'Usuario' : 'Contraseña';
    await copy(response.value[field], label);
  }

  const rowProps = (item: ItemSummary) => ({
    key: item.id,
    item,
    onOpen: () => {
      onOpen(item.id);
    },
    ...(item.type === 'login'
      ? {
          onCopyUsername: () => void copyField(item, 'username'),
          onCopyPassword: () => void copyField(item, 'password'),
        }
      : {}),
  });

  /*
   * Los favoritos se separan con un encabezado sólo mientras se ojea. Al buscar manda la
   * relevancia —así lo ordena `searchItems`— y agrupar entonces partiría los resultados
   * por un criterio que ya no es el que decide el orden.
   */
  const grouped = deferredQuery.length === 0 ? splitFavorites(visible) : null;

  return (
    <div className="relative flex h-full flex-col">
      <header className="flex items-center justify-between px-4 pt-4 pb-3">
        <h1 className="text-2xl font-semibold tracking-tight">Bóveda</h1>
        <span className="flex items-center gap-1">
          <ThemeToggle />
          <IconButton label="Bloquear la bóveda" onClick={onLock}>
            <Lock className="size-4" aria-hidden />
          </IconButton>
        </span>
      </header>

      <div className="px-4 pb-4">
        <SearchField
          value={query}
          onChange={setQuery}
          onArrowDown={focusFirst}
          resultCount={visible.length}
        />
      </div>

      <div className="panel relative flex min-h-0 flex-1 flex-col">
        <div className="px-3 pt-3 pb-1">
          <TypeTabs value={type} onChange={setType} counts={counts} />
        </div>

        {visible.length === 0 ? (
          emptyStateFor(
            items.length,
            query,
            () => {
              setQuery('');
              setType('all');
            },
            onCreate,
          )
        ) : (
          /*
            `min-h-0` es obligatorio: un hijo de flex no baja de su tamaño de contenido por
            defecto, así que sin esto la lista larga estira el contenedor y el pie se va
            fuera de los 600 px en vez de que aparezca el scroll.
          */
          <div className="relative min-h-0 flex-1">
            {/*
              Una sola `<ul>` aunque haya dos grupos. La navegación con flechas busca los
              botones dentro de esta lista (`useListNavigation`), así que partirla en dos
              listas rompería el recorrido justo en la frontera entre favoritos y el resto.
              Los encabezados van como `<li>` de presentación.
            */}
            <ul
              ref={listRef}
              onKeyDown={onKeyDown}
              className="flex h-full flex-col gap-0.5 overflow-y-auto px-2 pb-2"
              aria-label="Elementos de la bóveda"
            >
              {grouped === null ? (
                visible.map((item, index) => <ItemRow {...rowProps(item)} index={index} />)
              ) : (
                <>
                  {grouped.favorites.length > 0 && (
                    <>
                      <SectionLabel>Favoritos</SectionLabel>
                      {grouped.favorites.map((item, index) => (
                        <ItemRow {...rowProps(item)} index={index} />
                      ))}
                    </>
                  )}

                  {grouped.rest.length > 0 && (
                    <>
                      {grouped.favorites.length > 0 && <SectionLabel>Todos</SectionLabel>}
                      {grouped.rest.map((item, index) => (
                        <ItemRow {...rowProps(item)} index={index + grouped.favorites.length} />
                      ))}
                    </>
                  )}
                </>
              )}
            </ul>

            {/*
              La última fila se desvanece contra el pie en vez de quedar cortada por la
              mitad. Es la señal de que hay más abajo: sin ella, una lista que termina justo
              en el borde parece que ha terminado de verdad.
            */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-surface to-transparent"
            />
          </div>
        )}

        {missingRecoveryCode && (
          <p className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-warn">
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
            Esta bóveda no tiene código de respaldo.
          </p>
        )}

        {damagedCount > 0 && (
          <p
            role="alert"
            className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-warn"
          >
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
            {damagedCount} registro(s) no se pudieron descifrar.
          </p>
        )}

        {/*
          Iconos a la izquierda y la acción principal como píldora a la derecha. Crear no es
          lo que más se hace en un gestor de contraseñas —lo que más se hace es buscar y
          copiar—, así que ocupa el sitio de una acción destacada, no el de una barra
          entera.
        */}
        <footer className="flex items-center gap-2 border-t border-border/60 px-3 py-2.5">
          <IconButton label="Respaldo y recuperación" onClick={onBackup}>
            <LifeBuoy className="size-4" aria-hidden />
          </IconButton>

          <span className="flex-1" />

          <Button onClick={onCreate} className="rounded-full px-5">
            <Plus className="size-4" aria-hidden />
            Nuevo
          </Button>
        </footer>
      </div>

      {/*
        `key` con el id del aviso y no con el texto: copiar dos contraseñas seguidas produce
        el mismo mensaje, React reutilizaría el nodo y el segundo aviso aparecería sin
        animarse — que es justo cuando hace falta ver que el clic entró.
      */}
      {feedback !== null && (
        <Toast key={feedback.id} message={feedback.message} tone={feedback.tone} aboveFooter />
      )}
    </div>
  );
}

/** Encabezado de grupo. `presentation` porque es una etiqueta, no un elemento de la lista. */
function SectionLabel({ children }: { readonly children: string }) {
  return (
    <li role="presentation" className="px-2 pt-3 pb-1 text-xs font-medium text-dim">
      {children}
    </li>
  );
}

/**
 * Parte la lista en favoritos y resto.
 *
 * `searchItems` ya deja los favoritos delante cuando no hay búsqueda, así que esto no
 * reordena nada: sólo encuentra dónde está la frontera.
 */
function splitFavorites(items: readonly ItemSummary[]) {
  const cut = items.findIndex((item) => !item.favorite);
  if (cut === -1) return { favorites: items, rest: [] as readonly ItemSummary[] };
  return { favorites: items.slice(0, cut), rest: items.slice(cut) };
}

/**
 * Bóveda vacía y búsqueda sin resultados no son lo mismo y no se muestran igual: la
 * primera pide crear el primer item, la segunda deshacer el filtro. Un «0 resultados» a
 * secas dejaría al usuario sin salida en ambos casos.
 */
function emptyStateFor(total: number, query: string, onReset: () => void, onCreate: () => void) {
  if (total === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Tu bóveda está vacía"
        description="Guarda tu primera contraseña. Se cifrará aquí mismo y no saldrá de este equipo."
        action={{ label: 'Guardar la primera', onClick: onCreate }}
      />
    );
  }

  return (
    <EmptyState
      icon={SearchX}
      title={query.length > 0 ? `Nada coincide con «${query}»` : 'Nada en este filtro'}
      description="Prueba con menos letras o revisa el tipo seleccionado."
      action={{ label: 'Ver todo', onClick: onReset }}
    />
  );
}
