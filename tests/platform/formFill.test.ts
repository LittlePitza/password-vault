// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fillInput,
  fillLogin,
  findLoginFields,
  findUsernameField,
  isFillable,
} from '@/src/platform/formFill';

/**
 * Detección y relleno de formularios, contra un DOM simulado.
 *
 * ── Por qué hay que fingir la geometría ───────────────────────────────────────
 * jsdom construye el árbol pero no maqueta: no hay motor de layout, así que
 * `getBoundingClientRect()` devuelve 0×0 para absolutamente todo. Como `isFillable`
 * descarta los campos sin tamaño —que es justo su cometido—, sin simular las medidas
 * ningún test pasaría y estaríamos comprobando lo contrario de lo que queremos.
 *
 * Se simula sólo el tamaño. La visibilidad (`display`, `visibility`) sí la resuelve jsdom
 * a partir de los estilos en línea, y es lo que de verdad se está probando.
 */

/** Da tamaño a un elemento, como si el navegador lo hubiera maquetado. */
function laidOut<T extends HTMLElement>(element: T, width = 200, height = 30): T {
  element.getBoundingClientRect = () =>
    ({ width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0 }) as DOMRect;
  return element;
}

/** Monta un formulario desde HTML y maqueta todos sus campos. */
function mountForm(html: string): HTMLFormElement {
  document.body.innerHTML = `<form>${html}</form>`;
  const form = document.querySelector('form');
  if (form === null) throw new Error('sin formulario');

  for (const input of form.querySelectorAll('input')) laidOut(input);
  return form;
}

const password = () => document.querySelector<HTMLInputElement>('input[type="password"]')!;

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('isFillable()', () => {
  it('acepta un campo normal', () => {
    mountForm('<input type="password">');
    expect(isFillable(password())).toBe(true);
  });

  it.each([
    ['deshabilitado', '<input type="password" disabled>'],
    ['de sólo lectura', '<input type="password" readonly>'],
    ['con display:none', '<input type="password" style="display:none">'],
    ['con visibility:hidden', '<input type="password" style="visibility:hidden">'],
    ['transparente', '<input type="password" style="opacity:0">'],
  ])('rechaza un campo %s', (_caso, html) => {
    /*
     * No es una comprobación estética. Un formulario de acceso escondido es la forma
     * conocida de conseguir que un gestor de contraseñas entregue la credencial sin que
     * el usuario vea nada que pulsar.
     */
    mountForm(html);
    expect(isFillable(password())).toBe(false);
  });

  it('rechaza un campo de tamaño ínfimo', () => {
    mountForm('<input type="password">');
    laidOut(password(), 1, 1);

    expect(isFillable(password())).toBe(false);
  });
});

describe('findUsernameField()', () => {
  it('prefiere el que la página declara con autocomplete', () => {
    mountForm(`
      <input name="algo">
      <input name="otro" autocomplete="username">
      <input type="password">
    `);

    expect(findUsernameField(password())?.name).toBe('otro');
  });

  it('cae en las pistas del nombre cuando no hay declaración', () => {
    mountForm(`
      <input name="busqueda">
      <input name="correo">
      <input type="password">
    `);

    expect(findUsernameField(password())?.name).toBe('correo');
  });

  it('NO elige un campo que va después de la contraseña', () => {
    // Lo de después suele ser «repite la contraseña» u otra cosa. Rellenarlo con el
    // usuario sería peor que no rellenar nada.
    mountForm(`
      <input type="password">
      <input name="usuario">
    `);

    expect(findUsernameField(password())).toBeNull();
  });

  it('ignora los campos ocultos al buscar el usuario', () => {
    mountForm(`
      <input name="usuario" style="display:none">
      <input name="correo">
      <input type="password">
    `);

    expect(findUsernameField(password())?.name).toBe('correo');
  });

  it('devuelve null si no hay ningún candidato', () => {
    // Los formularios de acceso en dos pasos sólo enseñan la contraseña.
    mountForm('<input type="password">');
    expect(findUsernameField(password())).toBeNull();
  });

  it('no cruza la frontera de otro formulario', () => {
    document.body.innerHTML = `
      <form><input name="usuario-de-otro"></form>
      <form><input type="password"></form>
    `;
    for (const input of document.querySelectorAll('input')) laidOut(input);

    expect(findUsernameField(password())).toBeNull();
  });
});

describe('findLoginFields()', () => {
  it('empareja cada contraseña con su usuario', () => {
    mountForm(`
      <input name="correo">
      <input type="password">
    `);

    const found = findLoginFields(document);

    expect(found).toHaveLength(1);
    expect(found[0]?.username?.name).toBe('correo');
  });

  it('no devuelve formularios ocultos', () => {
    mountForm('<input type="password" style="display:none">');
    expect(findLoginFields(document)).toHaveLength(0);
  });
});

describe('fillInput()', () => {
  it('escribe el valor', () => {
    mountForm('<input type="password">');
    fillInput(password(), 'secreto');

    expect(password().value).toBe('secreto');
  });

  it('dispara los eventos que esperan React, Vue y Angular', () => {
    /*
     * Sin estos eventos el framework no se entera: la pantalla enseñaría la contraseña
     * puesta y al enviar el formulario iría vacía. Es el fallo clásico del autocompletado
     * y por eso se fija con un test.
     */
    mountForm('<input type="password">');
    const input = password();

    const onInput = vi.fn();
    const onChange = vi.fn();
    input.addEventListener('input', onInput);
    input.addEventListener('change', onChange);

    fillInput(input, 'secreto');

    expect(onInput).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('los eventos suben, que es donde escuchan los frameworks', () => {
    mountForm('<input type="password">');
    const onInput = vi.fn();
    document.body.addEventListener('input', onInput);

    fillInput(password(), 'secreto');

    expect(onInput).toHaveBeenCalledOnce();
  });
});

describe('fillLogin()', () => {
  it('rellena usuario y contraseña', () => {
    mountForm(`
      <input name="correo">
      <input type="password">
    `);
    const fields = findLoginFields(document)[0]!;

    fillLogin(fields, 'juan', 'secreto');

    expect(fields.username?.value).toBe('juan');
    expect(fields.password.value).toBe('secreto');
  });

  it('funciona sin campo de usuario', () => {
    mountForm('<input type="password">');
    const fields = findLoginFields(document)[0]!;

    fillLogin(fields, 'juan', 'secreto');

    expect(fields.password.value).toBe('secreto');
  });

  it('no escribe un usuario vacío encima de lo que ya haya', () => {
    // El segundo paso de un acceso en dos pantallas: el sitio ya trae el correo puesto.
    mountForm(`
      <input name="correo" value="ya-estaba">
      <input type="password">
    `);
    const fields = findLoginFields(document)[0]!;

    fillLogin(fields, '', 'secreto');

    expect(fields.username?.value).toBe('ya-estaba');
  });
});
