import { useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, Star, Wand2 } from 'lucide-react';
import { send } from '@/src/messaging/client';
import { ITEM_TYPES, type ItemType, type VaultItem, toSummary } from '@/src/core/model/item';
import type { ItemDraft } from '@/src/core/vault/vaultService';
import { itemDraftSchema } from '@/src/messaging/protocol';
import { describeAnyError } from '@/src/core/vault/errors';
import { IconButton } from '@/src/ui/components/IconButton';
import { TextField } from '@/src/ui/components/TextField';
import { PasswordField } from '@/src/ui/components/PasswordField';
import { PasswordGenerator } from '@/src/ui/components/PasswordGenerator';
import { ItemTypeIcon, TYPE_ICONS, TYPE_LABELS } from '@/src/ui/components/ItemTypeIcon';
import { Button } from '@/src/ui/components/Button';

interface ItemFormProps {
  /** `null` para crear. Al editar, el tipo ya no se puede cambiar. */
  readonly existing: VaultItem | null;
  readonly onCancel: () => void;
  readonly onSaved: () => void;
}

/** Qué es cada tipo, en cinco palabras. Va en el selector, antes de elegir. */
const TYPE_HINTS: Readonly<Record<ItemType, string>> = {
  login: 'Usuario y contraseña',
  note: 'Texto libre',
  card: 'Tarjeta bancaria',
};

/**
 * Alta y edición de items.
 *
 * La validación no se reescribe aquí: se ejecuta el **mismo esquema zod** que valida el
 * mensaje al llegar al service worker y que valida el item al descifrarlo. Duplicar las
 * reglas en el formulario es la forma clásica de que la interfaz acepte algo que el
 * núcleo luego rechaza.
 *
 * ── Lo que hace intuitivo este formulario ─────────────────────────────────────
 * Dos decisiones, y las dos van contra la versión corta de «un formulario es una pila de
 * campos»:
 *
 * 1. **Arriba se ve la fila que estás creando**, actualizándose mientras escribes. Un
 *    formulario normal te hace guardar para descubrir qué has hecho. Aquí el resultado va
 *    delante, así que se entiende antes de rellenar nada que lo que se está montando es
 *    una entrada de la lista — y se ve al momento que el subtítulo de una tarjeta son los
 *    cuatro últimos dígitos y el de una credencial es el usuario.
 * 2. **El tipo se elige con tres tarjetas grandes**, no con tres píldoras de texto. Es la
 *    primera decisión y la que cambia todo lo demás: si eliges mal, rellenas el formulario
 *    equivocado. Merece el tamaño y merece el icono.
 */
export function ItemForm({ existing, onCancel, onSaved }: ItemFormProps) {
  const login = existing?.type === 'login' ? existing : null;
  const note = existing?.type === 'note' ? existing : null;
  const card = existing?.type === 'card' ? existing : null;

  const [type, setType] = useState<ItemType>(existing?.type ?? 'login');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [favorite, setFavorite] = useState(existing?.favorite ?? false);

  const [username, setUsername] = useState(login?.username ?? '');
  const [password, setPassword] = useState(login?.password ?? '');
  const [urls, setUrls] = useState(login?.urls.join('\n') ?? '');
  const [notes, setNotes] = useState(login?.notes ?? '');
  const [showGenerator, setShowGenerator] = useState(false);

  const [body, setBody] = useState(note?.body ?? '');

  const [cardholder, setCardholder] = useState(card?.cardholder ?? '');
  const [number, setNumber] = useState(card?.number ?? '');
  const [expMonth, setExpMonth] = useState(card?.expMonth ?? '');
  const [expYear, setExpYear] = useState(card?.expYear ?? '');
  const [cvv, setCvv] = useState(card?.cvv ?? '');

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function buildDraft(): ItemDraft {
    const base = { title: title.trim(), favorite };

    switch (type) {
      case 'login':
        return {
          ...base,
          type: 'login',
          username: username.trim(),
          password,
          // Una dirección por línea. Se limpian las vacías para que un salto de más no
          // acabe guardado como un dominio en blanco.
          urls: urls
            .split('\n')
            .map((url) => url.trim())
            .filter((url) => url.length > 0),
          ...(notes.trim().length > 0 ? { notes: notes.trim() } : {}),
        };

      case 'note':
        return { ...base, type: 'note', body };

      case 'card':
        return {
          ...base,
          type: 'card',
          cardholder: cardholder.trim(),
          number: number.trim(),
          expMonth: expMonth.trim(),
          expYear: expYear.trim(),
          cvv: cvv.trim(),
        };
    }
  }

  async function save(event: React.SyntheticEvent): Promise<void> {
    event.preventDefault();
    if (busy) return;

    const draft = buildDraft();
    const parsed = itemDraftSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisa los datos.');
      return;
    }

    setBusy(true);
    setError(null);

    const response =
      existing === null
        ? await send({ type: 'vault/create', draft: parsed.data })
        : await send({
            type: 'vault/update',
            item: {
              ...parsed.data,
              id: existing.id,
              createdAt: existing.createdAt,
              updatedAt: existing.updatedAt,
            },
          });

    setBusy(false);
    if (response.ok) onSaved();
    else setError(describeAnyError(response.error));
  }

  return (
    <form onSubmit={(event) => void save(event)} className="flex h-full flex-col">
      <header className="surface-glass z-10 flex items-center gap-1 border-b border-border px-2 py-2">
        <IconButton label="Descartar y volver" onClick={onCancel}>
          <ArrowLeft className="size-4" aria-hidden />
        </IconButton>
        <h1 className="flex-1 text-sm font-medium">
          {existing === null ? 'Nuevo elemento' : 'Editar'}
        </h1>
        <IconButton
          label={favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
          aria-pressed={favorite}
          onClick={() => {
            setFavorite((current) => !current);
          }}
          className={favorite ? 'text-accent' : ''}
        >
          {/*
            La estrella se rellena y pega un salto al marcarla. Es la única confirmación
            que hay: guardar el favorito no cambia nada más en pantalla.
          */}
          <Star
            key={String(favorite)}
            className={`size-4 ${favorite ? 'animate-pop-in fill-current' : ''}`}
            aria-hidden
          />
        </IconButton>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Preview draft={buildDraft()} favorite={favorite} />

        <div className="flex flex-col gap-5 p-3">
          {existing === null && <TypePicker value={type} onChange={setType} />}

          <Section title={type === 'note' ? 'La nota' : 'Identificación'}>
            <TextField
              label="Título"
              value={title}
              onChange={setTitle}
              placeholder={PLACEHOLDERS[type]}
              autoFocus
              maxLength={200}
            />
            {type === 'note' && (
              <TextField label="Contenido" value={body} onChange={setBody} multiline rows={9} />
            )}
          </Section>

          {type === 'login' && (
            <>
              <Section title="Acceso">
                <TextField
                  label="Usuario"
                  value={username}
                  onChange={setUsername}
                  placeholder="tu@correo.com"
                />

                <div className="flex flex-col gap-2">
                  <PasswordField
                    label="Contraseña"
                    value={password}
                    onChange={setPassword}
                    autoComplete="new-password"
                  />
                  {/*
                    Botón de verdad y no una liga subrayada: genera una contraseña, que es
                    una acción, no una navegación. Con la forma de liga, la mitad de la
                    gente no lo encontraba.
                  */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowGenerator((shown) => !shown);
                    }}
                    aria-expanded={showGenerator}
                    className="press flex cursor-pointer items-center gap-1.5 self-start rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-accent shadow-e1 transition-[border-color,box-shadow,scale] duration-150 ease-out-quad hover:border-field hover:shadow-e2"
                  >
                    <Wand2 className="size-3.5" aria-hidden />
                    {showGenerator ? 'Ocultar generador' : 'Generar una contraseña'}
                  </button>
                  {showGenerator && <PasswordGenerator onGenerate={setPassword} />}
                </div>
              </Section>

              <Section title="Dónde se usa">
                <TextField
                  label="Direcciones"
                  value={urls}
                  onChange={setUrls}
                  multiline
                  rows={2}
                  placeholder="https://github.com"
                  hint="Una por línea. Sirven para reconocer el sitio al autocompletar."
                />
                <TextField label="Notas" value={notes} onChange={setNotes} multiline />
              </Section>
            </>
          )}

          {type === 'card' && (
            <Section title="La tarjeta">
              <TextField
                label="Titular"
                value={cardholder}
                onChange={setCardholder}
                placeholder="Como aparece en la tarjeta"
              />
              <TextField
                label="Número"
                value={number}
                onChange={setNumber}
                mono
                inputMode="numeric"
                placeholder="0000 0000 0000 0000"
              />
              <div className="flex gap-2">
                <div className="flex-1">
                  <TextField
                    label="Mes"
                    value={expMonth}
                    onChange={setExpMonth}
                    mono
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="09"
                  />
                </div>
                <div className="flex-1">
                  <TextField
                    label="Año"
                    value={expYear}
                    onChange={setExpYear}
                    mono
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="2030"
                  />
                </div>
                <div className="flex-1">
                  <TextField
                    label="CVV"
                    value={cvv}
                    onChange={setCvv}
                    mono
                    inputMode="numeric"
                    maxLength={8}
                  />
                </div>
              </div>
            </Section>
          )}

          {error !== null && (
            <p role="alert" className="animate-view-in text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      </div>

      <footer className="surface-glass flex gap-2 border-t border-border p-2">
        <Button type="button" variant="ghost" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" busy={busy} disabled={title.trim().length === 0}>
          {busy ? 'Guardando…' : 'Guardar'}
        </Button>
      </footer>
    </form>
  );
}

/** Ejemplo de título por tipo. Un placeholder concreto explica el campo mejor que una ayuda. */
const PLACEHOLDERS: Readonly<Record<ItemType, string>> = {
  login: 'GitHub',
  note: 'Claves del router',
  card: 'Visa empresa',
};

/**
 * La fila que se está creando, en vivo.
 *
 * Se construye con `toSummary`, **la misma función que genera las filas de la lista**. No
 * es una imitación: si mañana el subtítulo de una tarjeta cambia de formato, cambia aquí
 * solo. Una vista previa que se dibuja aparte es una vista previa que acaba mintiendo.
 */
function Preview({ draft, favorite }: { readonly draft: ItemDraft; readonly favorite: boolean }) {
  const summary = toSummary({ ...draft, id: 'preview', createdAt: 0, updatedAt: 0 });
  const untitled = summary.title.length === 0;

  return (
    <div className="border-b border-border bg-surface/40 px-3 py-3">
      <p className="mb-2 text-xs font-medium text-dim">Así se verá en tu bóveda</p>

      <div className="surface-card flex items-center gap-3 p-2.5">
        <ItemTypeIcon type={summary.type} size="lg" />

        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1.5">
            {favorite && (
              <Star className="size-3 shrink-0 fill-current text-accent" aria-label="Favorito" />
            )}
            <span
              className={`truncate text-sm font-medium ${untitled ? 'text-dim italic' : 'text-text'}`}
            >
              {untitled ? 'Sin título todavía' : summary.title}
            </span>
          </span>

          {/*
            El guion es literal y no un hueco: una línea vacía haría que la tarjeta cambiara
            de alto en cuanto se escribe el usuario, y la vista previa daría un salto justo
            debajo del campo que se está rellenando.
          */}
          <span className="truncate text-xs text-dim">
            {summary.subtitle.length > 0 ? summary.subtitle : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Bloque de campos con su encabezado. Ordena un formulario largo sin añadirle pantallas. */
function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-xs font-semibold tracking-wide text-dim uppercase">{title}</h2>
      {children}
    </section>
  );
}

/**
 * La primera decisión del formulario, con el tamaño que le corresponde.
 *
 * ── Por qué radios de verdad y no botones ─────────────────────────────────────
 * El resto de la interfaz usa botones con `aria-pressed` porque filtran o conmutan. Esto
 * no: es exactamente una opción de un conjunto cerrado, que es la definición de un grupo
 * de radio. Y la diferencia no es de purismo — un `role="radio"` puesto sobre un `<button>`
 * **anuncia** el comportamiento de radio sin implementarlo: las flechas no moverían entre
 * las opciones y habría que programar el tabindex móvil a mano. Con `<input type="radio">`
 * de verdad y un `name` común, el navegador ya lo hace: flechas para moverse, una sola
 * parada de tabulación para el grupo, y el estado sale correcto en cualquier lector de
 * pantalla.
 *
 * El input va en `sr-only` y la tarjeta es su `<label>`, así que pulsar cualquier parte de
 * la tarjeta la selecciona. El anillo de foco se traslada a la tarjeta con
 * `has-[:focus-visible]`, porque el input real mide cero y su anillo no se vería.
 */
function TypePicker({
  value,
  onChange,
}: {
  readonly value: ItemType;
  readonly onChange: (value: ItemType) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2.5 text-xs font-semibold tracking-wide text-dim uppercase">
        ¿Qué vas a guardar?
      </legend>

      <div className="grid grid-cols-3 gap-2">
        {ITEM_TYPES.map((option) => {
          const active = option === value;
          const Icon = TYPE_ICONS[option];

          return (
            <label
              key={option}
              className={`press flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-[border-color,background-color,box-shadow,scale] duration-150 ease-out-quad has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${
                active
                  ? 'border-accent bg-accent/10 shadow-glow'
                  : 'border-border bg-surface shadow-e1 hover:border-field hover:shadow-e2'
              }`}
            >
              <input
                type="radio"
                name="item-type"
                value={option}
                checked={active}
                onChange={() => {
                  onChange(option);
                }}
                className="sr-only"
              />

              <Icon
                className={`size-5 transition-colors duration-150 ${active ? 'text-accent' : 'text-dim'}`}
                aria-hidden
              />
              <span className={`text-xs font-medium ${active ? 'text-text' : 'text-dim'}`}>
                {TYPE_LABELS[option]}
              </span>
              <span className="text-xs leading-tight text-dim">{TYPE_HINTS[option]}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
