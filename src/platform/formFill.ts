/**
 * Detectar formularios de acceso y rellenarlos.
 *
 * Sólo toca el DOM: no conoce la bóveda, no habla con el service worker y no sabe qué es
 * una credencial. Eso lo deja probable con un DOM simulado y, sobre todo, deja claro que
 * este archivo no puede filtrar nada por sí mismo — recibe una cadena y la escribe.
 */

/** Tipos de campo que valen como usuario. `tel` entra: algunos bancos piden el móvil. */
const USERNAME_TYPES = new Set(['text', 'email', 'tel', '']);

/**
 * Pistas de que un campo es el del usuario, en orden de confianza.
 *
 * Se miran varios atributos porque no hay ninguno obligatorio: `autocomplete="username"`
 * es lo correcto y casi nadie lo pone, así que hay que caer hacia `name`, `id` y demás.
 */
const USERNAME_HINTS = ['user', 'usuario', 'email', 'correo', 'login', 'account', 'cuenta', 'dni'];

export interface LoginFields {
  readonly password: HTMLInputElement;
  /** Puede faltar: hay formularios en dos pasos que sólo enseñan la contraseña. */
  readonly username: HTMLInputElement | null;
}

/**
 * ¿Está el campo a la vista y se puede escribir en él?
 *
 * Importa por seguridad, no por estética: los formularios ocultos son una técnica conocida
 * para que un gestor de contraseñas rellene credenciales que el usuario nunca ve y que la
 * página se lleva calladamente. Si no se ve, no se rellena.
 */
export function isFillable(input: HTMLInputElement): boolean {
  if (input.disabled || input.readOnly) return false;

  const rect = input.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) return false;

  const style = input.ownerDocument.defaultView?.getComputedStyle(input);
  if (style === undefined) return true;

  return style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
}

/** Campos de contraseña visibles del documento. */
export function findPasswordFields(root: Document | ShadowRoot): HTMLInputElement[] {
  return [...root.querySelectorAll<HTMLInputElement>('input[type="password"]')].filter(isFillable);
}

/**
 * Busca el campo de usuario que acompaña a una contraseña.
 *
 * Se recorre hacia atrás desde la contraseña y no hacia delante: en un formulario de
 * acceso el usuario va **antes**. Los que van después suelen ser «repite la contraseña» o
 * campos de otra cosa, y rellenarlos sería peor que no rellenar nada.
 */
export function findUsernameField(password: HTMLInputElement): HTMLInputElement | null {
  const scope = password.form ?? password.ownerDocument.body;
  const candidates = [...scope.querySelectorAll<HTMLInputElement>('input')].filter(
    (input) => USERNAME_TYPES.has(input.type) && isFillable(input),
  );

  const before = candidates.filter(
    // `DOCUMENT_POSITION_PRECEDING` = el candidato aparece antes que la contraseña.
    (input) => (password.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_PRECEDING) !== 0,
  );

  // Con `autocomplete="username"` no hay que adivinar: la página lo ha declarado.
  const declared = before.find((input) => input.autocomplete === 'username');
  if (declared !== undefined) return declared;

  const hinted = before.filter((input) => hasUsernameHint(input));
  // El más cercano a la contraseña de los que dan pistas; si ninguno da pistas, el último
  // que haya antes, que en un formulario de acceso normal es el correcto.
  return hinted.at(-1) ?? before.at(-1) ?? null;
}

function hasUsernameHint(input: HTMLInputElement): boolean {
  const haystack = [
    input.name,
    input.id,
    input.getAttribute('aria-label') ?? '',
    input.placeholder,
    input.autocomplete,
  ]
    .join(' ')
    .toLowerCase();

  return USERNAME_HINTS.some((hint) => haystack.includes(hint));
}

/** Empareja cada contraseña visible con su campo de usuario. */
export function findLoginFields(root: Document | ShadowRoot): LoginFields[] {
  return findPasswordFields(root).map((password) => ({
    password,
    username: findUsernameField(password),
  }));
}

/**
 * Escribe un valor en un campo como si lo hubiera tecleado el usuario.
 *
 * ── Por qué no basta `input.value = x` ────────────────────────────────────────
 * React —y Vue, y Angular— no leen el DOM: mantienen su propio estado y sólo lo
 * actualizan cuando les llega un evento. Asignar `value` directamente cambia lo que se ve
 * pero no lo que el framework cree, así que al enviar el formulario mandaría el valor
 * viejo: el usuario ve su contraseña puesta y el sitio le dice que está vacía.
 *
 * React además guarda el último valor que él escribió para detectar cambios. Asignar por
 * la propiedad normal actualiza ese registro y hace que React considere que no ha pasado
 * nada. Por eso se llama al setter nativo del prototipo, que escribe sin que el registro
 * de React se entere, y después se dispara el evento — que es cuando lo ve y se actualiza.
 */
export function fillInput(input: HTMLInputElement, value: string): void {
  // Separar el setter de su objeto es justo lo que hace falta aquí, y se le devuelve su
  // `this` con `.call(input, …)` tres líneas más abajo. La regla avisa del error de
  // hacerlo sin querer; esto es lo contrario.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

  if (setter === undefined) {
    input.value = value;
  } else {
    setter.call(input, value);
  }

  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Rellena usuario y contraseña, y deja el foco donde lo dejaría una persona. */
export function fillLogin(fields: LoginFields, username: string, password: string): void {
  if (fields.username !== null && username.length > 0) {
    fillInput(fields.username, username);
  }

  fillInput(fields.password, password);
  fields.password.focus();
}
