import { AlertTriangle, Check } from 'lucide-react';
import { TOAST_MS } from '../hooks/useCopyToClipboard';

interface ToastProps {
  readonly message: string;
  readonly tone: 'ok' | 'danger';
  /**
   * La superficie tiene una barra de acciones abajo y el aviso debe quedar por encima.
   *
   * Sin esto el aviso se posa justo sobre el botón «Nuevo» y lo tapa los tres segundos que
   * dura. Es `pointer-events-none`, así que el botón se podía seguir pulsando — pero no
   * ver dónde está la acción principal justo después de copiar algo es peor que no poder
   * pulsarla.
   */
  readonly aboveFooter?: boolean;
}

/**
 * Aviso efímero al pie de la superficie.
 *
 * `role="status"` y no `alert`: confirmar que algo se copió es información, no una
 * interrupción, y `alert` cortaría lo que el lector de pantalla estuviera diciendo.
 *
 * Quien lo muestra es responsable de retirarlo — tres segundos, según el sistema de
 * diseño. Un aviso que no se va solo acaba tapando la interfaz.
 *
 * ── La barra que se vacía ─────────────────────────────────────────────────────
 * Marca los segundos que le quedan al aviso en pantalla. No es adorno: el mensaje dice que
 * el portapapeles se limpiará en 30 s, y sin la barra es fácil confundir la desaparición
 * del aviso con que ya se limpió. Ver el mensaje irse por su propio pie deja claro que
 * son dos relojes distintos.
 *
 * Su duración sale de `TOAST_MS`, el mismo valor con el que el hook programa el borrado.
 * Escrita a mano en el CSS, cualquiera de los dos podría cambiar sin el otro y la barra
 * terminaría antes o después que el aviso.
 */
export function Toast({ message, tone, aboveFooter = false }: ToastProps) {
  const Icon = tone === 'ok' ? Check : AlertTriangle;

  // Fondo `surface` y no `elevated`: sobre navy-500 el rojo de error cae a 3.41:1 y
  // reprueba AA. Sobre navy-700 da 4.56:1 y sobre blanco 4.83:1 — pasa en las dos bandas,
  // que es la condición para que un token semántico valga.
  const tones =
    tone === 'ok' ? 'border-ok/30 bg-surface text-ok' : 'border-danger/30 bg-surface text-danger';

  return (
    <div
      role="status"
      className={`pointer-events-none absolute inset-x-3 z-20 flex animate-toast-in items-center gap-2 overflow-hidden rounded-xl border px-3 py-2.5 text-xs shadow-e3 ${aboveFooter ? 'bottom-16' : 'bottom-3'} ${tones}`}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {message}

      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left animate-drain bg-current opacity-40"
        style={{ animationDuration: `${String(TOAST_MS)}ms` }}
      />
    </div>
  );
}
