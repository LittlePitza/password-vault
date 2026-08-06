import { Moon, MonitorSmartphone, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { THEME_LABELS, type ThemePreference, useThemeMode } from '../themeMode';
import { IconButton } from './IconButton';

const ICONS: Readonly<Record<ThemePreference, LucideIcon>> = {
  system: MonitorSmartphone,
  light: Sun,
  night: Moon,
};

/** Qué viene después al pulsar. Va en el título para que no haya que adivinarlo. */
const NEXT: Readonly<Record<ThemePreference, ThemePreference>> = {
  system: 'light',
  light: 'night',
  night: 'system',
};

/**
 * Recorre las tres preferencias de tema: sistema → claro → noche.
 *
 * ── Por qué un ciclo y no un desplegable ──────────────────────────────────────
 * Son tres opciones. Un menú en una cabecera de 380 px cuesta un contenedor flotante, su
 * gestión de foco y su cierre al pulsar fuera, para ahorrar dos clics como mucho. El ciclo
 * cabe en 32 px.
 *
 * Lo que un ciclo se lleva por delante es la visibilidad del estado: el icono dice en qué
 * tema estás, pero no qué opciones hay. Por eso el `aria-label` dice las dos cosas —dónde
 * estás y a dónde vas— y el icono cambia con un `pop-in` para que el cambio no pase
 * desapercibido.
 */
export function ThemeToggle() {
  const { preference, cycle } = useThemeMode();
  const Icon = ICONS[preference];

  return (
    <IconButton
      label={`${THEME_LABELS[preference]}. Cambiar a: ${THEME_LABELS[NEXT[preference]].toLowerCase()}`}
      onClick={cycle}
    >
      <Icon key={preference} className="size-4 animate-pop-in" aria-hidden />
    </IconButton>
  );
}
