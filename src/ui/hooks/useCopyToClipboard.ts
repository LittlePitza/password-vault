import { useCallback, useEffect, useRef, useState } from 'react';
import { send } from '@/src/messaging/client';
import { CLIPBOARD_CLEAR_SECONDS } from '@/src/core/policy';

/**
 * Cuánto se queda el aviso en pantalla.
 *
 * Se exporta porque el propio aviso dibuja una barra que se vacía en ese tiempo. Si el
 * valor viviera además en el CSS, cambiar uno dejaría la barra mintiendo sobre cuándo
 * desaparece el mensaje.
 */
export const TOAST_MS = 3_000;

export interface CopyFeedback {
  /**
   * Identificador de esta aparición concreta.
   *
   * Copiar dos contraseñas seguidas produce el mismo texto, así que React reutilizaría el
   * mismo nodo y la animación de entrada no se volvería a lanzar: el segundo aviso saldría
   * sin moverse y parecería que el clic no hizo nada. Con el id como `key`, cada aviso es
   * un elemento nuevo y vuelve a entrar.
   */
  readonly id: number;
  readonly message: string;
  readonly tone: 'ok' | 'danger';
}

/**
 * Copia al portapapeles y programa su borrado.
 *
 * El copiado ocurre **aquí**, en el popup, y no en el service worker: escribir en el
 * portapapeles necesita un documento con foco y el worker no tiene ninguno. Lo que sí
 * hace el worker es programar el borrado, porque este popup habrá dejado de existir
 * mucho antes de que toque limpiar (ver `platform/clipboard.ts`).
 */
export function useCopyToClipboard() {
  const [feedback, setFeedback] = useState<CopyFeedback | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const show = useCallback((next: Omit<CopyFeedback, 'id'>) => {
    nextId.current += 1;
    setFeedback({ ...next, id: nextId.current });
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setFeedback(null);
    }, TOAST_MS);
  }, []);

  // Si el popup se cierra con el aviso en pantalla, el temporizador se queda apuntando a
  // un componente desmontado.
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(
    async (value: string, label: string): Promise<void> => {
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        // Pasa si el popup perdió el foco entre el clic y la escritura. No se reintenta:
        // decirlo es más útil que insistir en silencio.
        show({ message: 'No se pudo copiar. Inténtalo otra vez.', tone: 'danger' });
        return;
      }

      await send({ type: 'clipboard/scheduleClear' });
      show({
        message: `${label} copiado. Se borrará en ${String(CLIPBOARD_CLEAR_SECONDS)} s.`,
        tone: 'ok',
      });
    },
    [show],
  );

  return { feedback, copy };
}
