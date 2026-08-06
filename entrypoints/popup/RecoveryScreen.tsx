import { useState } from 'react';
import { ArrowLeft, LifeBuoy } from 'lucide-react';
import { send } from '@/src/messaging/client';
import { describeAnyError } from '@/src/core/vault/errors';
import { isWellFormedRecoveryCode } from '@/src/core/model/recoveryCodeFormat';
import { MIN_MASTER_PASSWORD_LENGTH } from '@/src/core/vault/masterPassword';
import { Button } from '@/src/ui/components/Button';
import { Emblem } from '@/src/ui/components/Emblem';
import { PasswordField } from '@/src/ui/components/PasswordField';
import { StrengthMeter } from '@/src/ui/components/StrengthMeter';
import { RecoveryCodeCard } from '@/src/ui/components/RecoveryCodeCard';

interface RecoveryScreenProps {
  readonly onCancel: () => void;
  readonly onFinished: () => void;
}

type Step = 'code' | 'new-password' | 'new-code';

/**
 * Recuperación en tres pasos, y los tres son obligatorios.
 *
 * Entrar con el código deja la bóveda abierta pero sin contraseña maestra utilizable, así
 * que el flujo no permite salir a medias: sin fijar una nueva, mañana el usuario estaría
 * exactamente igual de bloqueado. Y como el código usado ya está gastado — hubo que
 * sacarlo de donde estuviera guardado — se rota y se muestra el nuevo.
 */
export function RecoveryScreen({ onCancel, onFinished }: RecoveryScreenProps) {
  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [newCode, setNewCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitCode(event: React.SyntheticEvent) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    const response = await send({ type: 'vault/recoverWithCode', recoveryCode: code });
    setBusy(false);

    if (response.ok) {
      setCode('');
      setStep('new-password');
    } else {
      setError(describeAnyError(response.error));
    }
  }

  async function submitPassword(event: React.SyntheticEvent) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    const response = await send({
      type: 'vault/completeRecovery',
      newMasterPassword: password,
    });
    setBusy(false);

    setPassword('');
    setConfirmation('');

    if (response.ok) {
      setNewCode(response.value);
      setStep('new-code');
    } else {
      setError(describeAnyError(response.error));
    }
  }

  if (step === 'new-code') {
    return (
      <main className="flex h-full animate-view-in flex-col overflow-y-auto p-5">
        <RecoveryCodeCard code={newCode} confirmLabel="Terminar" onConfirmed={onFinished} />
      </main>
    );
  }

  if (step === 'new-password') {
    const valid =
      password.length >= MIN_MASTER_PASSWORD_LENGTH && password === confirmation && !busy;

    return (
      <main className="ambient flex h-full animate-view-in flex-col justify-center gap-5 p-5">
        <header className="flex animate-rise-in flex-col gap-2">
          <h1 className="text-lg font-semibold">Elige una contraseña maestra nueva</h1>
          <p className="text-sm text-dim">
            Entraste con el código de respaldo. Hay que fijar una contraseña ahora, o volverás a
            quedarte fuera.
          </p>
        </header>

        <form
          onSubmit={(e) => void submitPassword(e)}
          className="flex animate-rise-in flex-col gap-4 [animation-delay:80ms]"
        >
          <div className="flex flex-col gap-2">
            <PasswordField
              label="Nueva contraseña maestra"
              value={password}
              onChange={setPassword}
              autoFocus
              autoComplete="new-password"
            />
            <StrengthMeter password={password} />
          </div>

          <PasswordField
            label="Repite la contraseña"
            value={confirmation}
            onChange={setConfirmation}
            autoComplete="new-password"
          />

          {confirmation.length > 0 && password !== confirmation && (
            <p className="animate-view-in text-xs text-danger">Las contraseñas no coinciden.</p>
          )}

          {error !== null && (
            <p role="alert" className="animate-view-in text-sm text-danger">
              {error}
            </p>
          )}

          <Button type="submit" busy={busy} disabled={!valid}>
            {busy ? 'Guardando…' : 'Guardar y continuar'}
          </Button>
        </form>
      </main>
    );
  }

  return (
    <main className="ambient flex h-full animate-view-in flex-col justify-center gap-6 p-5">
      <header className="flex animate-rise-in flex-col items-center gap-3 text-center">
        <Emblem icon={LifeBuoy} working={busy} />
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold">Recuperar el acceso</h1>
          <p className="text-sm text-dim">
            Escribe el código de respaldo que guardaste al crear la bóveda.
          </p>
        </div>
      </header>

      <form
        onSubmit={(e) => void submitCode(e)}
        className="flex animate-rise-in flex-col gap-4 [animation-delay:80ms]"
      >
        <input
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
          }}
          placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
          autoFocus
          spellCheck={false}
          autoComplete="off"
          aria-label="Código de respaldo"
          /*
           * Se escribe a mano copiando de un papel, así que el espaciado va abierto: es lo
           * que permite ir comprobando grupo a grupo sin perder el sitio.
           */
          className="w-full rounded-lg border border-field bg-surface px-3 py-3 text-center font-mono text-sm tracking-[0.12em] shadow-e1 transition-[border-color,box-shadow] duration-150 ease-out-quad outline-none placeholder:text-dim/50 focus:border-accent focus:shadow-e2"
        />

        <p className="text-center text-xs text-dim">No importan mayúsculas, guiones ni espacios.</p>

        {error !== null && (
          <p role="alert" className="animate-view-in text-center text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" busy={busy} disabled={!isWellFormedRecoveryCode(code)}>
          {busy ? 'Comprobando…' : 'Recuperar'}
        </Button>

        <button
          type="button"
          onClick={onCancel}
          className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1 text-xs text-dim transition-colors duration-150 hover:text-text"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Volver
        </button>
      </form>
    </main>
  );
}
