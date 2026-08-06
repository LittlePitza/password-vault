import { useId } from 'react';

interface TextFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly hint?: string;
  readonly mono?: boolean;
  readonly multiline?: boolean;
  readonly rows?: number;
  readonly inputMode?: 'text' | 'numeric';
  readonly maxLength?: number;
  readonly autoFocus?: boolean;
}

/**
 * Campo de texto con etiqueta visible.
 *
 * La etiqueta se ve siempre, no vive en el `placeholder`: el placeholder desaparece al
 * escribir y a media línea el usuario ya no sabe qué campo está rellenando. Es de las
 * cosas que más se saltan y de las que más molestan.
 *
 * Al enfocar, la etiqueta se tiñe de acento junto al borde. Es un `group-focus-within` y
 * no un estado en React porque el navegador ya sabe dónde está el foco: duplicarlo en
 * estado sería otra fuente de verdad que puede discrepar de la real.
 */
export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  mono = false,
  multiline = false,
  rows = 3,
  inputMode = 'text',
  maxLength,
  autoFocus = false,
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;

  const shared = `w-full rounded-lg border border-field bg-surface px-3 py-2 text-sm text-text transition-[border-color,box-shadow] duration-150 ease-out-quad outline-none placeholder:text-dim/60 focus:border-accent ${
    mono ? 'font-mono' : ''
  }`;

  return (
    <div className="group flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-xs font-medium text-dim transition-colors duration-150 group-focus-within:text-accent"
      >
        {label}
      </label>

      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          autoFocus={autoFocus}
          aria-describedby={hint === undefined ? undefined : hintId}
          className={`${shared} resize-none`}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          placeholder={placeholder}
          inputMode={inputMode}
          maxLength={maxLength}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={hint === undefined ? undefined : hintId}
          className={shared}
        />
      )}

      {hint !== undefined && (
        <p id={hintId} className="text-xs text-dim">
          {hint}
        </p>
      )}
    </div>
  );
}
