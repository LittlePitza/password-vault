import { send } from '@/src/messaging/client';
import type { AutofillCandidate } from '@/src/core/vault/vaultService';
import { type LoginFields, fillLogin, findLoginFields } from '@/src/platform/formFill';

/**
 * Autocompletado dentro de la página.
 *
 * Este es el único código del proyecto que se ejecuta dentro de sitios que no
 * controlamos, así que se escribe suponiendo que la página es hostil.
 *
 * ── Lo que este script NO puede hacer ─────────────────────────────────────────
 *  · No tiene la bóveda ni la llave. Pide y recibe, nada más.
 *  · No decide a qué dominio pertenece: el service worker lo deduce del `sender` que
 *    rellena el navegador. Mentir sobre en qué página estamos no sirve de nada.
 *  · No recibe ninguna contraseña hasta que el usuario elige una credencial concreta.
 *    La lista que se dibuja aquí sólo lleva título y usuario.
 *
 * ── Por qué nada se rellena solo ──────────────────────────────────────────────
 * Rellenar al detectar el formulario sería más cómodo y es lo que hace que un gestor de
 * contraseñas se convierta en un problema: basta con que una página esconda un formulario
 * de acceso para llevarse la credencial sin que el usuario vea nada. Aquí hace falta un
 * clic sobre nuestro propio botón, y los campos ocultos se descartan antes (`isFillable`).
 */

const HOST_ID = 'pv-autofill-host';

export default defineContentScript({
  // Sólo web. Ni `file:`, ni las páginas internas del navegador, ni las de la extensión.
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',

  main() {
    const ui = new AutofillUi();

    // Delegación en el documento en vez de un listener por campo: las páginas modernas
    // montan y desmontan formularios continuamente, y así no hay nada que re-enganchar.
    document.addEventListener(
      'focusin',
      (event) => {
        // `isTrusted` distingue el foco de una persona del que la página se da a sí misma
        // por script. Sólo el primero abre la puerta.
        if (!event.isTrusted) return;

        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;

        const fields = fieldsFor(target);
        if (fields === null) {
          ui.hide();
          return;
        }

        ui.attachTo(target, fields);
      },
      true,
    );

    // El botón sigue al campo si la página se mueve bajo él.
    for (const event of ['scroll', 'resize'] as const) {
      window.addEventListener(
        event,
        () => {
          ui.reposition();
        },
        true,
      );
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') ui.hide();
    });
  },
});

/** ¿Pertenece este campo a un formulario de acceso que sepamos rellenar? */
function fieldsFor(input: HTMLInputElement): LoginFields | null {
  const all = findLoginFields(document);

  if (input.type === 'password') {
    return all.find((fields) => fields.password === input) ?? null;
  }

  // También se ofrece desde el campo de usuario: es donde se empieza a escribir.
  return all.find((fields) => fields.username === input) ?? null;
}

/**
 * El botón y su lista, dentro de un shadow DOM cerrado.
 *
 * Cerrado y no abierto: con `mode: 'closed'` la página no llega al contenido por
 * `element.shadowRoot`. No es una barrera infranqueable —quien controla la página controla
 * el motor— pero sí impide la lectura casual, y el estilo queda aislado en ambos sentidos:
 * ni heredamos el CSS del sitio ni se lo pisamos.
 */
class AutofillUi {
  private readonly root: ShadowRoot;
  private readonly button: HTMLButtonElement;
  private readonly list: HTMLDivElement;
  private anchor: HTMLInputElement | null = null;
  private fields: LoginFields | null = null;

  constructor() {
    const host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText = 'all: initial; position: absolute; top: 0; left: 0; z-index: 2147483647;';
    document.documentElement.append(host);

    this.root = host.attachShadow({ mode: 'closed' });
    this.root.append(styleSheet());

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'trigger';
    this.button.hidden = true;
    this.button.textContent = '🔑';
    this.button.title = 'Rellenar con Password Vault';
    this.button.setAttribute('aria-label', 'Rellenar con Password Vault');
    this.button.addEventListener('click', () => void this.openList());

    this.list = document.createElement('div');
    this.list.className = 'list';
    this.list.hidden = true;

    this.root.append(this.button, this.list);

    document.addEventListener('click', (event) => {
      // Un clic fuera cierra la lista. El botón vive en el shadow DOM, así que los clics
      // sobre él llegan aquí con `target` puesto en el host: por eso se compara con él.
      if (event.target !== host) this.closeList();
    });
  }

  attachTo(input: HTMLInputElement, fields: LoginFields): void {
    this.anchor = input;
    this.fields = fields;
    this.button.hidden = false;
    this.closeList();
    this.reposition();
  }

  hide(): void {
    this.anchor = null;
    this.fields = null;
    this.button.hidden = true;
    this.closeList();
  }

  reposition(): void {
    if (this.anchor === null) return;

    const rect = this.anchor.getBoundingClientRect();

    // Si el campo sale de la pantalla, el botón sobra.
    if (rect.width === 0 || rect.bottom < 0 || rect.top > window.innerHeight) {
      this.button.hidden = true;
      this.closeList();
      return;
    }

    this.button.hidden = false;
    const top = rect.top + window.scrollY;
    const left = rect.right + window.scrollX;

    // Pegado al borde derecho del campo, por dentro.
    this.button.style.transform = `translate(${String(left - 30)}px, ${String(top + rect.height / 2 - 11)}px)`;
    this.list.style.transform = `translate(${String(rect.left + window.scrollX)}px, ${String(top + rect.height + 4)}px)`;
  }

  private async openList(): Promise<void> {
    if (this.list.hidden === false) {
      this.closeList();
      return;
    }

    this.renderMessage('Buscando…');
    this.list.hidden = false;
    this.reposition();

    const response = await send({ type: 'autofill/candidates' });

    if (!response.ok) {
      // Casi siempre significa bóveda bloqueada. No se distingue el motivo en pantalla:
      // el detalle del error es información que esta página no necesita.
      this.renderMessage('Abre la extensión y desbloquea la bóveda.');
      return;
    }

    if (response.value.length === 0) {
      this.renderMessage('No hay credenciales guardadas para este sitio.');
      return;
    }

    this.renderCandidates(response.value);
  }

  private closeList(): void {
    this.list.hidden = true;
    this.list.replaceChildren();
  }

  private renderMessage(text: string): void {
    const message = document.createElement('p');
    message.className = 'message';
    message.textContent = text;
    this.list.replaceChildren(message);
  }

  private renderCandidates(candidates: readonly AutofillCandidate[]): void {
    const rows = candidates.map((candidate) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'row';

      const title = document.createElement('span');
      title.className = 'title';
      // `textContent` y no `innerHTML`: el título sale de la bóveda, pero tratarlo como
      // texto es gratis y cierra la puerta a que un título con marcado se ejecute aquí.
      title.textContent = candidate.title;

      const user = document.createElement('span');
      user.className = 'user';
      user.textContent = candidate.username;

      row.append(title, user);
      row.addEventListener('click', () => void this.fill(candidate.id));
      return row;
    });

    this.list.replaceChildren(...rows);
  }

  private async fill(id: string): Promise<void> {
    const fields = this.fields;
    if (fields === null) return;

    const response = await send({ type: 'autofill/fill', id });

    if (!response.ok) {
      this.renderMessage('No se pudo rellenar.');
      return;
    }

    fillLogin(fields, response.value.username, response.value.password);
    this.closeList();
  }
}

/**
 * Estilos del widget.
 *
 * Van dentro del shadow root y arrancan con `all: initial` en el host, así que ninguna
 * regla del sitio los alcanza. Sin eso, un `button { display: none }` de la página bastaría
 * para que el autocompletado desapareciera.
 */
function styleSheet(): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    button, p { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; }

    .trigger {
      position: absolute; top: 0; left: 0;
      width: 22px; height: 22px; padding: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; line-height: 1;
      border: 1px solid rgba(0,0,0,.15); border-radius: 6px;
      background: #fff; cursor: pointer;
      box-shadow: 0 1px 3px rgba(0,0,0,.18);
    }
    .trigger:hover { background: #f2f4f7; }

    .list {
      position: absolute; top: 0; left: 0;
      min-width: 240px; max-width: 340px; max-height: 260px; overflow-y: auto;
      padding: 4px;
      border: 1px solid rgba(0,0,0,.12); border-radius: 10px;
      background: #fff;
      box-shadow: 0 8px 24px rgba(0,0,0,.18);
    }

    .row {
      display: flex; flex-direction: column; gap: 2px;
      width: 100%; padding: 8px 10px;
      border: 0; border-radius: 7px; background: transparent;
      text-align: left; cursor: pointer;
    }
    .row:hover { background: #eef2ff; }
    .title { font-size: 13px; font-weight: 600; color: #101828; }
    .user  { font-size: 12px; color: #667085; }

    .message { padding: 10px 12px; font-size: 12px; color: #667085; }

    @media (prefers-color-scheme: dark) {
      .trigger, .list { background: #1d2939; border-color: rgba(255,255,255,.14); }
      .trigger:hover { background: #283344; }
      .row:hover { background: #2a3644; }
      .title { color: #f9fafb; }
      .user, .message { color: #98a2b3; }
    }
  `;
  return style;
}
