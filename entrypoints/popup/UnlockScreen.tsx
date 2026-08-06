import { useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { send } from '@/src/messaging/client';
import { describeAnyError } from '@/src/core/vault/errors';
import { Button } from '@/src/ui/components/Button';
import { Emblem } from '@/src/ui/components/Emblem';
import { PasswordField } from '@/src/ui/components/PasswordField';

interface UnlockScreenProps {
  readonly onUnlocked: () => void;
  readonly onForgotPassword: () => void;
}

/**
 * La pantalla que más veces se ve de toda la extensión.
 *
 * Es también la única que tiene una espera de verdad: derivar la llave con scrypt son
 * ~540 ms medidos, y esa lentitud es intencional. De ahí que sea la pantalla donde el
 * movimiento hace trabajo real en lugar de decorar — las ondas del distintivo y el
 * indicador del botón cubren ese medio segundo en el que, sin ellos, la interfaz parece
 * haberse quedado colgada.
 */
export function UnlockScreen({ onUnlocked, onForgotPassword }: UnlockScreenProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shaking, setShaking] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(event: React.SyntheticEvent) {
    event.preventDefault();
    if (password.length === 0 || busy) return;

    setBusy(true);
    setError(null);

    const response = await send({ type: 'vault/unlock', masterPassword: password });

    setBusy(false);
    // La contraseña se descarta del estado tanto si acierta como si falla: no debe
    // quedarse viva en el árbol de React más de lo necesario.
    setPassword('');

    if (response.ok) {
      onUnlocked();
      return;
    }

    setError(describeAnyError(response.error));
    setShaking(true);
    // Al fallar, el campo vuelve a tener el foco. Si se envió con el botón, el foco se
    // había quedado allí y reintentar obligaba a volver al campo con el ratón.
    formRef.current?.querySelector('input')?.focus();
  }

  return (
    <main className="ambient flex h-full flex-col justify-center gap-7 p-6">
      <header className="flex animate-rise-in flex-col items-center gap-3 text-center">
        <Emblem icon={Lock} working={busy} />
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold">Bóveda bloqueada</h1>
          <p className="text-xs text-dim">Tu contenido está cifrado en este equipo.</p>
        </div>
      </header>

      <form
        ref={formRef}
        onSubmit={(e) => void handleSubmit(e)}
        /*
         * La sacudida se enciende con estado y se apaga sola al terminar, en vez de
         * remontar el formulario con una `key`. Remontarlo funcionaría igual de bien para
         * repetir la animación y perdería el foco del campo justo cuando el usuario va a
         * volver a escribir.
         *
         * El guarda de `currentTarget` es necesario: `animationend` burbujea, así que las
         * entradas escalonadas de los hijos apagarían la sacudida antes de que empiece.
         */
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget) setShaking(false);
        }}
        className={`flex animate-rise-in flex-col gap-4 [animation-delay:80ms] ${shaking ? 'animate-shake' : ''}`}
      >
        <PasswordField
          label="Contraseña maestra"
          value={password}
          onChange={setPassword}
          autoFocus
        />

        {error !== null && (
          <p role="alert" className="animate-view-in text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" busy={busy} disabled={password.length === 0}>
          {busy ? 'Descifrando…' : 'Desbloquear'}
        </Button>

        <button
          type="button"
          onClick={onForgotPassword}
          className="cursor-pointer rounded-lg py-1 text-center text-xs text-dim transition-colors duration-150 hover:text-text"
        >
          Olvidé mi contraseña maestra
        </button>
      </form>
    </main>
  );
}
