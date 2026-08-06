/**
 * Plazos de seguridad de la aplicación.
 *
 * Viven en el núcleo, y no junto al código que los ejecuta, porque los necesitan los dos
 * lados de la frontera: `platform/` para programar las alarmas y la interfaz para
 * decirle al usuario cuánto tiempo tiene. Un número duplicado en ambos sitios acabaría
 * desincronizándose, y entonces la interfaz mentiría.
 */

/**
 * Cuánto sobrevive una contraseña en el portapapeles.
 *
 * 30 s es margen de sobra para cambiar de ventana y pegar, y poco para que se quede ahí
 * olvidada. Es el valor por defecto habitual del sector.
 */
export const CLIPBOARD_CLEAR_SECONDS = 30;

/** Inactividad tras la cual la bóveda se cierra sola. */
export const AUTO_LOCK_MINUTES = 15;
