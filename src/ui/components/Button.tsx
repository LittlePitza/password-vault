import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: Variant;
  /**
   * Trabajo en curso. Deshabilita el botón y enseña un indicador girando.
   *
   * Está aquí y no en cada pantalla porque las esperas de este producto son reales y
   * medibles: derivar la llave con scrypt son ~540 ms deliberados. Cambiar sólo la
   * etiqueta a «Descifrando…» deja medio segundo en el que la interfaz parece congelada.
   */
  readonly busy?: boolean;
  readonly children: ReactNode;
}

// `text-on-accent` en vez de `text-white`: en banda oscura el acento es verde y encima
// debe ir navy-900 (trampa 2 de la paleta), no blanco.
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent shadow-e1 hover:bg-accent-hover hover:shadow-glow',
  secondary:
    'border border-border bg-surface text-text shadow-e1 hover:border-field hover:shadow-e2',
  ghost: 'bg-transparent text-dim hover:bg-surface hover:text-text',
  danger: 'bg-transparent text-danger hover:bg-danger/10',
};

/*
 * El aspecto apagado va aparte de la variante y **no** se aplica cuando el botón está
 * ocupado.
 *
 * Ocupado y deshabilitado no son lo mismo aunque los dos impidan pulsar: deshabilitado
 * dice «esto todavía no se puede hacer» y ocupado dice «se está haciendo». Al pintarlos
 * igual, el medio segundo que tarda scrypt se leía como que el botón se había apagado
 * justo al pulsarlo. Ocupado conserva el color de acento y añade el indicador.
 */
const DISABLED: Record<Variant, string> = {
  primary: 'disabled:bg-border disabled:text-dim disabled:shadow-none',
  secondary: 'disabled:text-dim disabled:shadow-none',
  ghost: 'disabled:text-dim',
  danger: 'disabled:text-dim',
};

export function Button({
  variant = 'primary',
  busy = false,
  disabled = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || busy}
      /*
       * La lista de propiedades es explícita y no `transition-all` por dos motivos: `all`
       * interpola de más (cualquier propiedad futura entra sin que nadie lo decida), y
       * `scale` tiene que estar dentro porque esta utilidad pisa la transición que `.press`
       * trae por defecto.
       */
      className={`press inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-[background-color,box-shadow,border-color,color,scale] duration-150 ease-out-quad disabled:cursor-not-allowed ${VARIANTS[variant]} ${busy ? '' : DISABLED[variant]} ${className}`}
      {...props}
    >
      {busy && <Loader2 className="size-4 shrink-0 animate-orbit" aria-hidden />}
      {children}
    </button>
  );
}
