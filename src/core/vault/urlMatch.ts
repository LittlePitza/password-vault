import type { LoginItem, VaultItem } from '../model/item';

/**
 * Decide qué credenciales aplican a una página.
 *
 * Es la función más delicada del proyecto. Todo lo demás protege la bóveda de quien no
 * tiene la contraseña; esto decide a **qué sitio** se le entrega un secreto que sí está
 * desbloqueado. Un fallo aquí no filtra la bóveda entera, pero entrega la credencial
 * correcta al sitio equivocado, que para el usuario es igual de malo.
 *
 * Por eso vive en el núcleo, es pura, y se prueba contra los ataques concretos que tiene
 * que resistir en vez de contra el camino feliz.
 *
 * ── La regla ──────────────────────────────────────────────────────────────────
 * Se compara por **etiquetas de dominio**, jamás por subcadenas. `github.com` guardado
 * aplica a `github.com` y a `www.github.com`, pero no a `evil-github.com` ni a
 * `github.com.attacker.net` — ambos contienen la cadena «github.com» y ninguno es GitHub.
 *
 * La dirección importa: una credencial guardada para el dominio padre se ofrece en sus
 * subdominios, pero una guardada para `intranet.empresa.com` **no** se ofrece en
 * `empresa.com`. Quien la guardó fue específico a propósito.
 */

/** Sólo se autocompleta sobre la web. `file:`, `data:` o `javascript:` quedan fuera. */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Extrae el host de una URL, o `null` si no sirve para emparejar.
 *
 * Acepta lo que el usuario haya escrito en el formulario: tanto `https://github.com/login`
 * como `github.com` a secas. Nadie teclea el esquema al guardar una credencial, y exigirlo
 * convertiría un descuido en «el autocompletado no funciona y no sé por qué».
 */
export function hostOf(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) return null;

  // Sin esquema `new URL` falla, así que se asume https. Se prueba tal cual primero para
  // no re-etiquetar como https algo que vino declarado como otro protocolo: `file:///x`
  // debe rechazarse, no convertirse en `https://file/`.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null;

  // `hostname` excluye el puerto a propósito: la misma credencial vale en :443 y en :8443.
  // El punto final —`github.com.` es válido y equivalente— se normaliza.
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  return host.length === 0 ? null : host;
}

/**
 * ¿Es `host` el mismo dominio que `stored`, o un subdominio suyo?
 *
 * El `.` del prefijo es lo que hace segura la comparación: sin él, `endsWith('github.com')`
 * aceptaría `evil-github.com`. Con él sólo pasa lo que tiene una frontera de etiqueta real.
 */
function isSameOrSubdomain(host: string, stored: string): boolean {
  return host === stored || host.endsWith(`.${stored}`);
}

/**
 * ¿Tiene el host guardado suficientes etiquetas para emparejar por subdominio?
 *
 * Guardar `com` y dejar que aplique a todo `.com` sería catastrófico. Exigir dos etiquetas
 * lo impide en el caso evidente.
 *
 * No resuelve el caso general: `co.uk` tiene dos etiquetas y también es un sufijo público,
 * así que una credencial guardada ahí se ofrecería en cualquier `.co.uk`. Distinguirlo de
 * verdad exige la Public Suffix List —una tabla de miles de entradas que hay que mantener
 * actualizada— y no compensa para un gestor personal: hay que escribir `co.uk` a mano en
 * el campo de URLs para llegar a ese estado.
 */
function hasEnoughLabels(stored: string): boolean {
  return stored.split('.').filter((label) => label.length > 0).length >= 2;
}

/** ¿Aplica una URL guardada a este host? */
export function urlMatchesHost(storedUrl: string, host: string): boolean {
  const stored = hostOf(storedUrl);
  if (stored === null || host.length === 0) return false;

  // Una IP debe coincidir exacta: no existen «subdominios» de una IP, y `1.2.3.4`
  // terminando en `.3.4` no significa nada.
  if (isIpLiteral(stored) || isIpLiteral(host)) return stored === host;

  if (!hasEnoughLabels(stored)) return stored === host;

  return isSameOrSubdomain(host, stored);
}

/** IPv4 en decimal punteado, o IPv6 entre corchetes tal como lo devuelve `URL.hostname`. */
function isIpLiteral(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[');
}

/** ¿Alguna de las URLs de esta credencial aplica al host? */
export function loginMatchesHost(item: LoginItem, host: string): boolean {
  return item.urls.some((url) => urlMatchesHost(url, host));
}

/**
 * Credenciales aplicables a una página, de la más específica a la más general.
 *
 * El orden no es cosmético: si hay una guardada para `intranet.empresa.com` y otra para
 * `empresa.com`, en la intranet debe salir primero la específica. Quien guardó las dos
 * distinguió entre ellas por algún motivo.
 */
export function findLoginsForUrl(
  items: readonly VaultItem[],
  pageUrl: string,
): readonly LoginItem[] {
  const host = hostOf(pageUrl);
  if (host === null) return [];

  const matches = items
    .filter((item): item is LoginItem => item.type === 'login')
    .filter((item) => loginMatchesHost(item, host));

  return matches.sort((a, b) => {
    const specificity = bestSpecificity(b, host) - bestSpecificity(a, host);
    if (specificity !== 0) return specificity;
    return a.title.localeCompare(b.title, 'es');
  });
}

/**
 * Cuántas etiquetas del host cubre la URL que mejor casa de este item.
 *
 * `intranet.empresa.com` puntúa 3 y `empresa.com` puntúa 2, así que la primera gana.
 */
function bestSpecificity(item: LoginItem, host: string): number {
  let best = 0;
  for (const url of item.urls) {
    const stored = hostOf(url);
    if (stored !== null && urlMatchesHost(url, host)) {
      best = Math.max(best, stored.split('.').length);
    }
  }
  return best;
}
