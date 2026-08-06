import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Pencil, Star, Trash2 } from 'lucide-react';
import { send } from '@/src/messaging/client';
import type { VaultItem } from '@/src/core/model/item';
import { describeAnyError } from '@/src/core/vault/errors';
import { useCopyToClipboard } from '@/src/ui/hooks/useCopyToClipboard';
import { IconButton } from '@/src/ui/components/IconButton';
import { ItemTypeIcon, TYPE_LABELS } from '@/src/ui/components/ItemTypeIcon';
import { CopyRow } from '@/src/ui/components/CopyRow';
import { Toast } from '@/src/ui/components/Toast';
import { Button } from '@/src/ui/components/Button';

interface ItemDetailProps {
  readonly id: string;
  readonly onBack: () => void;
  readonly onEdit: (item: VaultItem) => void;
  readonly onDeleted: () => void;
}

/**
 * Detalle de un item.
 *
 * Ocupa la superficie entera en lugar de abrirse como diálogo: en 380 px de ancho, un
 * modal deja márgenes que no sobran y encima hay que gestionarle el foco. Sustituir la
 * vista es más simple y se lee mejor.
 *
 * El item completo se pide **al entrar aquí** y no viene con la lista. La lista sólo
 * maneja resúmenes; los secretos se piden de uno en uno y sólo tras una acción explícita.
 *
 * La entrada y la salida las pone el navegador, no este componente: `App` cambia de vista
 * a través de `navigate()` y la transición se define en `theme.css`. Por eso aquí no hay
 * ninguna clase de animación en la raíz — la habría duplicado.
 */
export function ItemDetail({ id, onBack, onEdit, onDeleted }: ItemDetailProps) {
  const [item, setItem] = useState<VaultItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { feedback, copy } = useCopyToClipboard();

  useEffect(() => {
    void (async () => {
      const response = await send({ type: 'vault/reveal', id });
      if (response.ok) setItem(response.value);
      else setError(describeAnyError(response.error));
    })();
  }, [id]);

  // Escape para volver: es el gesto reflejo cuando una vista ha sustituido a otra.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onBack();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onBack]);

  const remove = useCallback(async () => {
    const response = await send({ type: 'vault/delete', id });
    if (response.ok) onDeleted();
    else setError(describeAnyError(response.error));
  }, [id, onDeleted]);

  return (
    <div className="relative flex h-full flex-col">
      <header className="surface-glass z-10 flex items-center gap-1 border-b border-border px-2 py-2">
        <IconButton label="Volver a la lista" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden />
        </IconButton>

        <h1 className="min-w-0 flex-1 truncate text-sm font-medium">
          {item?.title ?? 'Cargando…'}
        </h1>

        {item !== null && (
          <>
            <IconButton
              label="Editar"
              onClick={() => {
                onEdit(item);
              }}
            >
              <Pencil className="size-4" aria-hidden />
            </IconButton>
            <IconButton
              label="Eliminar"
              onClick={() => {
                setConfirmingDelete(true);
              }}
              className="hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 className="size-4" aria-hidden />
            </IconButton>
          </>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {item === null ? (
          <Skeleton error={error} />
        ) : (
          <>
            {/*
              Cabecera del item, sobre superficie propia. Repite el título que ya está en
              la barra a propósito: la barra lo corta a un renglón y aquí cabe entero, y es
              donde el icono de tipo dice de qué se trata antes de leer un solo campo.
            */}
            <div className="surface-card mb-2 flex animate-rise-in items-center gap-3 p-3">
              <ItemTypeIcon type={item.type} size="lg" />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{item.title}</span>
                <span className="flex items-center gap-1 text-xs text-dim">
                  {item.favorite && (
                    <Star className="size-3 fill-current text-accent" aria-label="Favorito" />
                  )}
                  {TYPE_LABELS[item.type]}
                </span>
              </div>
            </div>

            <div className="animate-rise-in [animation-delay:60ms]">
              <Fields item={item} onCopy={(value, label) => void copy(value, label)} />
            </div>
          </>
        )}
      </div>

      {confirmingDelete && (
        <div className="flex animate-sheet-in flex-col gap-2 border-t border-danger/30 bg-danger/5 p-3">
          {/* Confirmación obligatoria: no hay papelera y esto no se deshace. */}
          <p className="text-xs text-danger">
            Se elimina definitivamente. No hay forma de recuperarlo salvo desde un respaldo
            anterior.
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setConfirmingDelete(false);
              }}
            >
              Cancelar
            </Button>
            <Button variant="danger" className="flex-1" onClick={() => void remove()}>
              Eliminar
            </Button>
          </div>
        </div>
      )}

      {feedback !== null && (
        <Toast key={feedback.id} message={feedback.message} tone={feedback.tone} />
      )}
    </div>
  );
}

function Fields({
  item,
  onCopy,
}: {
  readonly item: VaultItem;
  readonly onCopy: (value: string, label: string) => void;
}) {
  switch (item.type) {
    case 'login':
      return (
        <>
          {item.username.length > 0 && (
            <CopyRow
              label="Usuario"
              value={item.username}
              onCopy={() => {
                onCopy(item.username, 'Usuario');
              }}
            />
          )}
          <CopyRow
            label="Contraseña"
            value={item.password}
            secret
            onCopy={() => {
              onCopy(item.password, 'Contraseña');
            }}
          />
          {item.urls.map((url) => (
            <CopyRow
              key={url}
              label="Sitio"
              value={url}
              onCopy={() => {
                onCopy(url, 'Dirección');
              }}
            />
          ))}
          {item.notes !== undefined && item.notes.length > 0 && (
            <CopyRow
              label="Notas"
              value={item.notes}
              onCopy={() => {
                onCopy(item.notes ?? '', 'Notas');
              }}
            />
          )}
        </>
      );

    case 'note':
      return (
        <div className="flex flex-col gap-1.5 py-2">
          <span className="text-xs text-dim">Contenido</span>
          <p className="text-sm whitespace-pre-wrap text-text">{item.body}</p>
          <Button
            variant="secondary"
            className="mt-1 self-start"
            onClick={() => {
              onCopy(item.body, 'Nota');
            }}
          >
            Copiar nota
          </Button>
        </div>
      );

    case 'card':
      return (
        <>
          <CopyRow
            label="Titular"
            value={item.cardholder}
            onCopy={() => {
              onCopy(item.cardholder, 'Titular');
            }}
          />
          <CopyRow
            label="Número"
            value={item.number}
            secret
            onCopy={() => {
              onCopy(item.number, 'Número');
            }}
          />
          <CopyRow
            label="Caducidad"
            value={`${item.expMonth}/${item.expYear}`}
            onCopy={() => {
              onCopy(`${item.expMonth}/${item.expYear}`, 'Caducidad');
            }}
          />
          <CopyRow
            label="CVV"
            value={item.cvv}
            secret
            onCopy={() => {
              onCopy(item.cvv, 'CVV');
            }}
          />
        </>
      );
  }
}

/**
 * Esqueleto mientras se descifra, en vez de dejar la pantalla en blanco.
 *
 * Con un brillo que lo recorre y no con un latido: el latido dice «espera», el brillo dice
 * «esto viene en camino». Detrás hay un descifrado real que termina siempre, así que la
 * segunda es la lectura correcta.
 */
function Skeleton({ error }: { readonly error: string | null }) {
  if (error !== null) {
    return (
      <p role="alert" className="py-4 text-sm text-danger">
        {error}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 py-3" aria-busy="true" aria-label="Descifrando">
      <div className="skeleton h-12" />
      <div className="skeleton h-8 w-2/3" />
      <div className="skeleton h-8" />
      <div className="skeleton h-8 w-1/2" />
    </div>
  );
}
