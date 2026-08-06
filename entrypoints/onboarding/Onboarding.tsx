import { useState } from 'react';
import { AlertTriangle, Check, ShieldCheck } from 'lucide-react';
import { send } from '@/src/messaging/client';
import { describeAnyError } from '@/src/core/vault/errors';
import { MIN_MASTER_PASSWORD_LENGTH } from '@/src/core/vault/masterPassword';
import { Button } from '@/src/ui/components/Button';
import { Emblem } from '@/src/ui/components/Emblem';
import { PasswordField } from '@/src/ui/components/PasswordField';
import { StrengthMeter } from '@/src/ui/components/StrengthMeter';
import { RecoveryCodeCard } from '@/src/ui/components/RecoveryCodeCard';

/**
 * Creación de la bóveda. Se abre una sola vez, al instalar.
 *
 * La advertencia de "no hay recuperación" es una casilla obligatoria y no un texto en
 * gris al pie: es la consecuencia más importante de todo el diseño, y el momento de
 * entenderla es *antes* de guardar contraseñas, no cuando ya se olvidó la maestra.
 *
 * Es la única superficie que no vive en 380 px, así que es donde el sistema de diseño se
 * puede permitir aire: la tarjeta va centrada sobre el campo de luz, y los bloques entran
 * escalonados. Es la primera impresión del producto y la única vez que se ve esta
 * pantalla.
 */
export function Onboarding() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** null = aún en el formulario · string = mostrando el código · 'done' = terminado. */
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const tooShort = password.length > 0 && password.length < MIN_MASTER_PASSWORD_LENGTH;
  const mismatch = confirmation.length > 0 && password !== confirmation;
  const canSubmit =
    password.length >= MIN_MASTER_PASSWORD_LENGTH &&
    password === confirmation &&
    acknowledged &&
    !busy;

  async function handleSubmit(event: React.SyntheticEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);

    const response = await send({ type: 'vault/initialize', masterPassword: password });

    setBusy(false);
    if (response.ok) {
      // Este es el único momento en que el código existe en claro.
      setRecoveryCode(response.value);
      // Las contraseñas se limpian del estado de React en cuanto dejan de hacer falta.
      setPassword('');
      setConfirmation('');
    } else {
      setError(describeAnyError(response.error));
    }
  }

  if (recoveryCode !== null && !done) {
    return (
      <main className="ambient flex min-h-screen flex-col justify-center px-6 py-10">
        <div className="surface-card mx-auto w-full max-w-md animate-view-in p-6">
          <RecoveryCodeCard
            code={recoveryCode}
            onConfirmed={() => {
              setRecoveryCode(null);
              setDone(true);
            }}
          />
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main className="ambient flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <Emblem icon={Check} tone="ok" />
        <h1 className="animate-rise-in text-2xl font-semibold [animation-delay:80ms]">
          Tu bóveda está lista
        </h1>
        <p className="max-w-md animate-rise-in text-sm text-dim [animation-delay:140ms]">
          Ya puedes cerrar esta pestaña. Abre la extensión desde la barra del navegador para empezar
          a guardar contraseñas.
        </p>
        <p className="mt-2 max-w-md animate-rise-in text-xs text-dim [animation-delay:200ms]">
          Recuerda hacer una copia del contenido de vez en cuando: el código de respaldo devuelve el
          acceso, pero si se pierde el equipo hace falta además un archivo de respaldo para
          recuperar los datos.
        </p>
      </main>
    );
  }

  return (
    <main className="ambient flex min-h-screen flex-col justify-center px-6 py-10">
      <div className="mx-auto flex w-full max-w-md flex-col gap-7">
        <header className="flex animate-rise-in flex-col items-center gap-4 text-center">
          <Emblem icon={ShieldCheck} working={busy} />
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold">Crea tu contraseña maestra</h1>
            <p className="text-sm text-dim">
              Es la única llave de tu bóveda. Todo se cifra en este dispositivo y nada se envía a
              ningún servidor.
            </p>
          </div>
        </header>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="surface-card flex animate-rise-in flex-col gap-5 p-6 [animation-delay:80ms]"
        >
          <div className="flex flex-col gap-2">
            <PasswordField
              label="Contraseña maestra"
              value={password}
              onChange={setPassword}
              autoFocus
              autoComplete="new-password"
              describedBy="strength"
            />
            <StrengthMeter password={password} id="strength" />
            {tooShort && (
              <p className="animate-view-in text-xs text-warn">
                Mínimo {MIN_MASTER_PASSWORD_LENGTH} caracteres. Una frase que recuerdes es mejor que
                una palabra corta con símbolos.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <PasswordField
              label="Repite la contraseña"
              value={confirmation}
              onChange={setConfirmation}
              autoComplete="new-password"
            />
            {mismatch && (
              <p className="animate-view-in text-xs text-danger">Las contraseñas no coinciden.</p>
            )}
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-warn/30 bg-warn/5 p-3 transition-colors duration-150 hover:border-warn/50">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => {
                setAcknowledged(event.target.checked);
              }}
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-warn"
            />
            <span className="flex flex-col gap-1 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-warn">
                <AlertTriangle className="size-3.5" aria-hidden />
                Entiendo que no hay forma de recuperarla
              </span>
              <span className="text-dim">
                Tu contraseña maestra no se guarda en ningún sitio, ni siquiera cifrada. Si la
                olvidas, el contenido de la bóveda se pierde de forma definitiva.
              </span>
            </span>
          </label>

          {error !== null && (
            <p role="alert" className="animate-view-in text-sm text-danger">
              {error}
            </p>
          )}

          <Button type="submit" busy={busy} disabled={!canSubmit}>
            {busy ? 'Creando la bóveda…' : 'Crear bóveda'}
          </Button>

          <p className="text-center text-xs text-dim">
            Crear la bóveda tarda alrededor de medio segundo. Esa lentitud es intencional: es lo que
            encarece un ataque por fuerza bruta.
          </p>
        </form>
      </div>
    </main>
  );
}
