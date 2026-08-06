import { useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  Download,
  KeyRound,
  Upload,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { send } from '@/src/messaging/client';
import { describeAnyError } from '@/src/core/vault/errors';
import { Button } from '@/src/ui/components/Button';
import { PasswordField } from '@/src/ui/components/PasswordField';
import { RecoveryCodeCard } from '@/src/ui/components/RecoveryCodeCard';

interface BackupPanelProps {
  readonly onBack: () => void;
  readonly missingRecoveryCode: boolean;
}

type Mode = 'menu' | 'export' | 'import' | 'new-code';

export function BackupPanel({ onBack, missingRecoveryCode }: BackupPanelProps) {
  const [mode, setMode] = useState<Mode>('menu');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function reset(next: Mode) {
    setMode(next);
    setPassword('');
    setMessage(null);
    setError(null);
  }

  async function handleExport(event: React.SyntheticEvent) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    const response = await send({ type: 'vault/exportBackup', password });
    setBusy(false);
    setPassword('');

    if (!response.ok) {
      setError(describeAnyError(response.error));
      return;
    }

    // La descarga se dispara desde el popup y no desde el service worker: el archivo
    // nunca pasa por disco sin cifrar, es un Blob en memoria que el navegador guarda.
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(response.value, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `password-vault-${stamp}.json`;
    link.click();
    URL.revokeObjectURL(url);

    setMessage(`Respaldo con ${String(response.value.itemCount)} elemento(s) descargado.`);
  }

  async function handleImport(event: React.SyntheticEvent) {
    event.preventDefault();
    const file = fileInput.current?.files?.[0];
    if (!file || busy) return;

    setBusy(true);
    setError(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setBusy(false);
      setError('Ese archivo no es un respaldo válido.');
      return;
    }

    const response = await send({ type: 'vault/importBackup', file: parsed, password });
    setBusy(false);
    setPassword('');

    if (response.ok) {
      const { added, updated, skipped } = response.value;
      setMessage(
        `Importado: ${String(added)} nuevo(s), ${String(updated)} actualizado(s), ${String(skipped)} sin cambios.`,
      );
    } else {
      setError(describeAnyError(response.error));
    }
  }

  async function handleRotate() {
    setBusy(true);
    setError(null);
    const response = await send({ type: 'vault/rotateRecoveryCode' });
    setBusy(false);

    if (response.ok) {
      setNewCode(response.value);
      setMode('new-code');
    } else {
      setError(describeAnyError(response.error));
    }
  }

  if (mode === 'new-code') {
    return (
      <main className="flex h-full flex-col overflow-y-auto p-5">
        <RecoveryCodeCard
          code={newCode}
          confirmLabel="Listo"
          onConfirmed={() => {
            reset('menu');
          }}
        />
      </main>
    );
  }

  return (
    <main className="flex h-full flex-col overflow-y-auto p-5">
      <button
        type="button"
        onClick={
          mode === 'menu'
            ? onBack
            : () => {
                reset('menu');
              }
        }
        className="mb-4 flex cursor-pointer items-center gap-1.5 self-start rounded-lg py-1 text-xs text-dim transition-colors duration-150 hover:text-text"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Volver
      </button>

      {mode === 'menu' && (
        <div className="flex flex-col gap-3">
          <h1 className="animate-rise-in text-lg font-semibold">Respaldo</h1>

          {missingRecoveryCode && (
            <p className="flex animate-rise-in items-start gap-2 rounded-xl border border-warn/30 bg-warn/5 p-3 text-xs text-warn">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Esta bóveda no tiene código de respaldo. Genera uno ahora: sin él, olvidar la
              contraseña maestra significa perderlo todo.
            </p>
          )}

          <MenuButton
            icon={Download}
            delay={60}
            title="Exportar a un archivo"
            description="Copia cifrada de todo el contenido. Es lo único que salva los datos si se pierde el equipo."
            onClick={() => {
              reset('export');
            }}
          />
          <MenuButton
            icon={Upload}
            delay={120}
            title="Importar un respaldo"
            description="Fusiona con lo que ya tienes. Reimportar el mismo archivo no duplica nada."
            onClick={() => {
              reset('import');
            }}
          />
          <MenuButton
            icon={KeyRound}
            delay={180}
            title={missingRecoveryCode ? 'Generar código de respaldo' : 'Regenerar código'}
            description="Invalida el anterior. Úsalo si crees que se filtró o si acabas de recuperar con él."
            onClick={() => void handleRotate()}
          />

          {error !== null && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      )}

      {mode === 'export' && (
        <form
          onSubmit={(e) => void handleExport(e)}
          className="flex animate-rise-in flex-col gap-4"
        >
          <h1 className="text-lg font-semibold">Exportar</h1>
          <p className="text-xs text-dim">
            Elige una contraseña para el archivo. Puede ser tu maestra, pero el archivo seguirá
            abriéndose con ésta aunque luego la cambies.
          </p>

          <PasswordField
            label="Contraseña del archivo"
            value={password}
            onChange={setPassword}
            autoFocus
            autoComplete="new-password"
          />

          <p className="flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/5 p-3 text-xs text-warn">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Este archivo <strong>es</strong> tu bóveda. No lo dejes en OneDrive ni en ninguna
            carpeta sincronizada: subiría todo a la nube.
          </p>

          <Button type="submit" busy={busy} disabled={password.length === 0}>
            {busy ? 'Cifrando…' : 'Descargar respaldo'}
          </Button>

          <Feedback message={message} error={error} />
        </form>
      )}

      {mode === 'import' && (
        <form
          onSubmit={(e) => void handleImport(e)}
          className="flex animate-rise-in flex-col gap-4"
        >
          <h1 className="text-lg font-semibold">Importar</h1>

          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            aria-label="Archivo de respaldo"
            className="cursor-pointer rounded-lg border border-border bg-surface p-2 text-xs text-dim shadow-e1 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-accent/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-accent"
          />

          <PasswordField
            label="Contraseña del archivo"
            value={password}
            onChange={setPassword}
            autoComplete="off"
          />

          <Button type="submit" busy={busy} disabled={password.length === 0}>
            {busy ? 'Descifrando…' : 'Importar'}
          </Button>

          <Feedback message={message} error={error} />
        </form>
      )}
    </main>
  );
}

/**
 * Cada opción del menú de respaldo.
 *
 * Va con el icono en su propia ficha y una flecha al final: las tres llevan a otra
 * pantalla, y sin la flecha se leen como botones que ejecutan algo ahí mismo. La de
 * regenerar el código sí lo hace, y es justo por eso por lo que las tres tienen que
 * parecer lo mismo hasta que se pulsan — la diferencia se explica en su descripción, no
 * en su forma.
 */
function MenuButton({
  icon: Icon,
  title,
  description,
  delay,
  onClick,
}: {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
  readonly delay: number;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${String(delay)}ms` }}
      className="group surface-card flex animate-rise-in cursor-pointer items-start gap-3 p-3 text-left transition-[box-shadow,border-color] duration-150 ease-out-quad hover:border-field hover:shadow-e2"
    >
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent ring-1 ring-accent/20 ring-inset">
        <Icon className="size-4" aria-hidden />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-dim">{description}</span>
      </span>

      <ChevronRight
        className="mt-1 size-4 shrink-0 text-dim transition-transform duration-200 ease-out-expo group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  );
}

function Feedback({
  message,
  error,
}: {
  readonly message: string | null;
  readonly error: string | null;
}) {
  return (
    <>
      {message !== null && (
        <p className="flex animate-view-in items-start gap-2 rounded-xl border border-ok/30 bg-ok/5 p-3 text-xs text-ok">
          <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {message}
        </p>
      )}
      {error !== null && (
        <p role="alert" className="animate-view-in text-sm text-danger">
          {error}
        </p>
      )}
    </>
  );
}
