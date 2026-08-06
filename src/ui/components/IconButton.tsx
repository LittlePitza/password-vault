import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /**
   * Obligatorio, no opcional: un botón que sólo contiene un icono es invisible para un
   * lector de pantalla sin él. Al estar en el tipo, olvidarlo no compila.
   */
  readonly label: string;
  readonly children: ReactNode;
}

/**
 * Botón de sólo icono, 32 × 32.
 *
 * Sobre el tamaño: la guía táctil de 44 px es de iOS/Android y no aplica a un popup de
 * escritorio de 380 px. Lo que aplica es WCAG 2.2 AA (2.5.8), que pide 24 × 24 px; 32 lo
 * supera con margen y deja sitio para la densidad que necesita la lista.
 *
 * Lleva `.press` porque es el botón de copiar, y copiar no cambia nada en pantalla: sin
 * un acuse en el propio botón, la única señal de que el clic entró llega 200 ms después
 * en forma de aviso al pie.
 */
export function IconButton({ label, className = '', ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`press inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-dim transition-[background-color,color,scale] duration-150 ease-out-quad hover:bg-surface hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...props}
    />
  );
}
