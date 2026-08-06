import { useCallback, useEffect, useState } from 'react';

/**
 * Preferencia de tema.
 *
 * `system` no es «claro»: es «lo que diga el sistema operativo, y que cambie con él».
 * Quien tiene el portátil en automático por horario espera que la extensión le siga.
 */
export type ThemePreference = 'system' | 'light' | 'night';

/** Lo que acaba aplicándose. `system` se resuelve a uno de estos dos. */
type Resolved = 'light' | 'night';

const STORAGE_KEY = 'pv.theme';
const ORDER: readonly ThemePreference[] = ['system', 'light', 'night'];

export const THEME_LABELS: Readonly<Record<ThemePreference, string>> = {
  system: 'Tema del sistema',
  light: 'Tema claro',
  night: 'Modo noche',
};

/**
 * Por qué `localStorage` y no `chrome.storage`.
 *
 * La frontera que impone eslint dice que la interfaz no toca la plataforma: los datos de
 * la bóveda se piden por mensaje al service worker. Esto no son datos de la bóveda — es
 * una preferencia de visualización que no sale del popup y que no interesa a nadie más.
 *
 * Y hay una razón técnica encima: `chrome.storage` es asíncrono, y el tema tiene que estar
 * aplicado **antes** del primer pintado (ver `public/theme-boot.js`). Un ida y vuelta al
 * service worker garantizaría el fogonazo que ese script existe para evitar.
 */
function read(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'night' || stored === 'system' ? stored : 'system';
  } catch {
    // El almacenamiento puede estar bloqueado por política de empresa. Sin preferencia
    // guardada, seguir al sistema es el comportamiento menos sorprendente.
    return 'system';
  }
}

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(preference: ThemePreference): Resolved {
  if (preference === 'system') return prefersDark() ? 'night' : 'light';
  return preference;
}

function apply(preference: ThemePreference): void {
  document.documentElement.dataset.theme = resolve(preference);
}

/**
 * Preferencia de tema con su ciclo de cambio.
 *
 * El botón que la usa recorre las tres opciones en vez de abrir un menú: son tres, caben
 * en un ciclo y un desplegable en una cabecera de 380 px cuesta más de lo que resuelve. El
 * estado actual va en el `aria-label` del botón, así que quien no ve el icono tampoco se
 * queda sin saber en qué tema está.
 */
export function useThemeMode() {
  const [preference, setPreference] = useState<ThemePreference>(read);

  // Con la preferencia en `system`, seguir al sistema significa reaccionar cuando cambia
  // —de día a noche por horario, por ejemplo— y no sólo al abrir el popup.
  useEffect(() => {
    if (preference !== 'system') return;

    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      apply('system');
    };
    query.addEventListener('change', onChange);
    return () => {
      query.removeEventListener('change', onChange);
    };
  }, [preference]);

  const cycle = useCallback(() => {
    setPreference((current) => {
      const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? 'system';
      apply(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Sin poder guardar, el tema vale para esta sesión y se pierde al cerrar. Es peor
        // que persista, pero mucho mejor que no dejar cambiarlo.
      }
      return next;
    });
  }, []);

  return { preference, cycle };
}
