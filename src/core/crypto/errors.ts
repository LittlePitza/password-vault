/**
 * Errores criptográficos esperados, como unión discriminada.
 *
 * Importante: `wrong-password` y `corrupt-data` se distinguen por el *contexto* de la
 * operación, no por lo que dice AES-GCM. GCM falla igual en ambos casos — y esa
 * ambigüedad es deliberada: no debe existir forma de saber si una llave es "casi"
 * correcta.
 */
export type CryptoError =
  | { readonly kind: 'wrong-password' }
  | { readonly kind: 'corrupt-data'; readonly detail: string }
  | { readonly kind: 'unsupported-version'; readonly found: number; readonly supported: number };

export function wrongPassword(): CryptoError {
  return { kind: 'wrong-password' };
}

export function corruptData(detail: string): CryptoError {
  return { kind: 'corrupt-data', detail };
}

export function unsupportedVersion(found: number, supported: number): CryptoError {
  return { kind: 'unsupported-version', found, supported };
}

/** Mensaje legible para la UI. Nunca incluye material criptográfico. */
export function describeCryptoError(error: CryptoError): string {
  switch (error.kind) {
    case 'wrong-password':
      return 'Contraseña maestra incorrecta.';
    case 'corrupt-data':
      return 'Un registro de la bóveda está dañado y no pudo leerse.';
    case 'unsupported-version':
      return `Esta bóveda usa el formato v${String(error.found)}, pero esta versión de la extensión sólo entiende hasta v${String(error.supported)}.`;
  }
}
