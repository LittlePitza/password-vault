import type { LucideIcon } from 'lucide-react';

type Tone = 'accent' | 'ok' | 'warn';

interface EmblemProps {
  readonly icon: LucideIcon;
  readonly tone?: Tone;
  /**
   * Hay trabajo real en curso. Suelta ondas concéntricas en vez del latido de reposo.
   *
   * Se usa mientras scrypt deriva la llave, que en la máquina de referencia son ~540 ms
   * medidos. Ese medio segundo es deliberado —es lo que encarece un ataque por fuerza
   * bruta— pero sin nada en pantalla se lee como que la extensión se ha colgado.
   */
  readonly working?: boolean;
}

const TONES: Record<Tone, string> = {
  accent: 'bg-accent/10 text-accent ring-accent/25',
  ok: 'bg-ok/10 text-ok ring-ok/25',
  warn: 'bg-warn/10 text-warn ring-warn/25',
};

const AURA: Record<Tone, string> = {
  accent: 'bg-accent/25',
  ok: 'bg-ok/25',
  warn: 'bg-warn/25',
};

const WAVE: Record<Tone, string> = {
  accent: 'border-accent/40',
  ok: 'border-ok/40',
  warn: 'border-warn/40',
};

/**
 * Distintivo de las pantallas sin lista: bloqueo, recuperación, alta y final del alta.
 *
 * Es el único sitio donde esta interfaz se permite un momento de escenografía, y lo hace
 * porque son pantallas de una sola cosa: no compiten con nada. En la lista no aparece —
 * ahí el protagonista son los datos.
 *
 * Todo lo animado va en `aria-hidden` y el icono no lleva texto propio: el título que
 * viene justo debajo ya dice de qué pantalla se trata, y anunciar «candado» antes sería
 * ruido para quien escucha.
 */
export function Emblem({ icon: Icon, tone = 'accent', working = false }: EmblemProps) {
  return (
    <span className="relative inline-flex size-16 items-center justify-center">
      <span
        aria-hidden
        className={`absolute inset-1 rounded-full blur-md ${AURA[tone]} ${working ? '' : 'animate-breathe'}`}
      />

      {working && (
        <>
          <span
            aria-hidden
            className={`absolute inset-0 animate-halo rounded-full border ${WAVE[tone]}`}
          />
          <span
            aria-hidden
            className={`absolute inset-0 animate-halo rounded-full border [animation-delay:600ms] ${WAVE[tone]}`}
          />
        </>
      )}

      <span
        className={`relative inline-flex size-12 items-center justify-center rounded-full ring-1 ring-inset ${TONES[tone]}`}
      >
        <Icon className="size-6" aria-hidden />
      </span>
    </span>
  );
}
