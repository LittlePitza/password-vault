import { useState } from 'react';
import { Check, Info } from 'lucide-react';
import { send } from '@/src/messaging/client';
import { describeAnyError } from '@/src/core/vault/errors';
import { MIN_MASTER_PASSWORD_LENGTH } from '@/src/core/vault/masterPassword';
import { Button } from '@/src/ui/components/Button';
import { PasswordField } from '@/src/ui/components/PasswordField';
import { StrengthMeter } from '@/src/ui/components/StrengthMeter';

interface ChangeMasterPasswordFormProps {
  readonly onDone: () => void;
}

/**
 * Cambio de la contraseña maestra teniendo la actual.
 *
 * Es el camino distinto al de `RecoveryScreen`: allí se llega sin saber la contraseña y
 * hay que fijar una nueva a la fuerza; aquí se sabe y el cambio es voluntario. Por eso
 * este formulario sí se puede abandonar a medias sin dejar la bóveda en mal estado.
 *
 * Sólo se re-envuelve la DEK, así que el cambio es instantáneo por muchos items que haya
 * — pero cuesta dos derivaciones de scrypt (abrir con la vieja, cerrar con la nueva), casi
 * un segundo en el que el botón tiene que mostrar que está trabajando.
 */
export function ChangeMasterPasswordForm({ onDone }: ChangeMasterPasswordFormProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState(false);

  const mismatch = confirmation.length > 0 && next !== confirmation;
  const sameAsCurrent = next.length > 0 && next === current;
  const canSubmit =
    current.length > 0 &&
    next.length >= MIN_MASTER_PASSWORD_LENGTH &&
    next === confirmation &&
    !sameAsCurrent &&
    !busy;

  async function handleSubmit(event: React.SyntheticEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);

    const response = await send({
      type: 'vault/changeMasterPassword',
      currentPassword: current,
      newPassword: next,
    });

    setBusy(false);

    // Las tres contraseñas se van del estado de React pase lo que pase: si falló, el
    // usuario reescribe — es más barato que dejarlas en memoria esperando al recolector.
    setCurrent('');
    setNext('');
    setConfirmation('');

    if (response.ok) {
      setChanged(true);
    } else {
      setError(describeAnyError(response.error));
    }
  }

  if (changed) {
    return (
      <div className="flex animate-view-in flex-col gap-4">
        <h1 className="text-lg font-semibold">Contraseña cambiada</h1>

        <p className="flex items-start gap-2 rounded-xl border border-ok/30 bg-ok/5 p-3 text-xs text-ok">
          <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />A partir de ahora la bóveda se
          abre con la contraseña nueva. La sesión actual sigue abierta.
        </p>

        <p className="text-xs text-dim">
          Tu código de respaldo <strong className="font-medium text-text">no ha cambiado</strong> y
          sigue siendo válido: abre la bóveda por su propio camino, independiente de la contraseña
          maestra. Si querías invalidarlo, regenéralo desde el menú anterior.
        </p>

        <Button onClick={onDone}>Listo</Button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex animate-rise-in flex-col gap-4">
      <h1 className="text-lg font-semibold">Cambiar la contraseña maestra</h1>

      <PasswordField
        label="Contraseña actual"
        value={current}
        onChange={setCurrent}
        autoFocus
        autoComplete="current-password"
      />

      <div className="flex flex-col gap-2">
        <PasswordField
          label="Nueva contraseña"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          describedBy="fuerza-nueva"
        />
        <StrengthMeter password={next} id="fuerza-nueva" />
      </div>

      <PasswordField
        label="Repite la nueva"
        value={confirmation}
        onChange={setConfirmation}
        autoComplete="new-password"
      />

      {mismatch && (
        <p className="animate-view-in text-xs text-danger">Las contraseñas no coinciden.</p>
      )}

      {sameAsCurrent && (
        <p className="animate-view-in text-xs text-warn">
          La nueva contraseña es igual que la actual.
        </p>
      )}

      <p className="flex items-start gap-2 rounded-xl border border-border bg-surface/50 p-3 text-xs text-dim">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        El contenido no se vuelve a cifrar: sólo cambia el envoltorio de la llave. Tu código de
        respaldo seguirá siendo válido.
      </p>

      {error !== null && (
        <p role="alert" className="animate-view-in text-sm text-danger">
          {error}
        </p>
      )}

      <Button type="submit" busy={busy} disabled={!canSubmit}>
        {busy ? 'Cambiando…' : 'Cambiar contraseña'}
      </Button>
    </form>
  );
}
