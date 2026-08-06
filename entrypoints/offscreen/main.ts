/**
 * Documento offscreen: borra el portapapeles y se cierra.
 *
 * Se crea desde `src/platform/clipboard.ts` cuando salta la alarma, hace su único trabajo
 * y desaparece. No tiene interfaz y nunca es visible.
 */

if (new URLSearchParams(location.search).get('action') === 'clear') {
  overwriteClipboard();
  window.close();
}

/**
 * Deja un espacio en el portapapeles.
 *
 * No una cadena vacía: `execCommand('copy')` sobre una selección vacía no hace nada y el
 * secreto seguiría ahí. Un espacio es la forma más pequeña de sobrescribirlo de verdad.
 */
function overwriteClipboard(): void {
  const field = document.createElement('textarea');
  field.value = ' ';
  document.body.append(field);
  field.select();

  // `execCommand` está obsoleto, pero es la única vía en un documento offscreen: la API
  // asíncrona del portapapeles exige que el documento tenga el foco, y éste nunca lo
  // tiene. Es lo que documenta Chrome para el motivo `CLIPBOARD`.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  document.execCommand('copy');

  field.remove();
}
