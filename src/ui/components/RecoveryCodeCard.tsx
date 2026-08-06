import { useState } from 'react';
import { AlertTriangle, Check, Copy, Printer } from 'lucide-react';
import { Button } from './Button';

interface RecoveryCodeCardProps {
  readonly code: string;
  /** Texto del botón de confirmación. */
  readonly confirmLabel?: string;
  readonly onConfirmed: () => void;
}

/**
 * Muestra el código de respaldo. Es la **única** vez que existe fuera de su envoltorio
 * cifrado, así que la pantalla está diseñada para que sea difícil pasarla de largo:
 * la confirmación exige marcar una casilla, no basta con pulsar "siguiente".
 *
 * La advertencia sobre carpetas sincronizadas no es genérica. Guardar este código en
 * OneDrive o Drive sube la llave de la bóveda a la nube — justo lo que este proyecto
 * evita al ser local.
 *
 * ── Por qué el código está tratado como un objeto y no como un párrafo ────────
 * Es lo único de esta pantalla que hay que copiar a mano a un papel. Va en su propia
 * tarjeta, en mono, con el interlineado abierto y el aro de acento alrededor: todo el
 * peso visual empuja hacia él, porque el fallo caro aquí es que alguien lo pase por alto
 * y siga adelante.
 */
export function RecoveryCodeCard({
  code,
  confirmLabel = 'Ya lo guardé en un lugar seguro',
  onConfirmed,
}: RecoveryCodeCardProps) {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex animate-rise-in flex-col gap-2">
        <h2 className="text-lg font-semibold">Tu código de respaldo</h2>
        <p className="text-sm text-dim">
          Es la única forma de abrir la bóveda si olvidas la contraseña maestra. Se muestra ahora y
          no se puede volver a ver.
        </p>
      </div>

      <output className="animate-pop-in rounded-xl border border-accent/30 bg-accent/5 px-4 py-5 text-center font-mono text-lg leading-relaxed tracking-[0.12em] break-all shadow-e1 select-all [animation-delay:120ms]">
        {code}
      </output>

      <div className="flex animate-rise-in gap-2 [animation-delay:200ms]">
        <Button type="button" variant="secondary" className="flex-1" onClick={copy}>
          {copied ? (
            <Check className="size-4 animate-pop-in text-ok" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={() => {
            window.print();
          }}
        >
          <Printer className="size-4" aria-hidden />
          Imprimir
        </Button>
      </div>

      <div className="flex animate-rise-in flex-col gap-2 rounded-xl border border-warn/30 bg-warn/5 p-3 text-xs [animation-delay:260ms]">
        <span className="flex items-center gap-1.5 font-medium text-warn">
          <AlertTriangle className="size-3.5" aria-hidden />
          Dónde NO guardarlo
        </span>
        <ul className="flex list-disc flex-col gap-1 pl-4 text-dim">
          <li>
            <strong className="font-medium text-text">En OneDrive, Drive o Dropbox.</strong> Subiría
            la llave de tu bóveda a la nube, que es justo lo que esta extensión evita.
          </li>
          <li>En un archivo de texto o nota del propio equipo, junto a la bóveda.</li>
          <li>En el correo, ni siquiera enviándotelo a ti.</li>
        </ul>
        <span className="text-dim">
          Impreso en un cajón con llave, o en un gestor físico, es mejor sitio que cualquier carpeta
          del ordenador. Quien tenga este código entra sin la contraseña maestra.
        </span>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg p-1 transition-colors duration-150 hover:bg-surface">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => {
            setAcknowledged(event.target.checked);
          }}
          className="mt-0.5 size-4 shrink-0 cursor-pointer accent-accent"
        />
        <span className="text-xs text-dim">
          Guardé el código fuera de este equipo y entiendo que no se volverá a mostrar.
        </span>
      </label>

      <Button type="button" disabled={!acknowledged} onClick={onConfirmed}>
        {confirmLabel}
      </Button>
    </div>
  );
}
