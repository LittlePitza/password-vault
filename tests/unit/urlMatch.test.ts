import { describe, expect, it } from 'vitest';
import { findLoginsForUrl, hostOf, urlMatchesHost } from '@/src/core/vault/urlMatch';
import type { LoginItem, VaultItem } from '@/src/core/model/item';

/**
 * El emparejamiento de dominios, probado contra los ataques que tiene que resistir.
 *
 * Los tests del camino feliz aquí valen poco: lo que decide si esta función es correcta o
 * peligrosa son los casos en que un dominio *parece* otro. Cada `it` de la sección de
 * seguridad corresponde a una forma real de suplantar un dominio.
 */

function login(title: string, urls: readonly string[]): LoginItem {
  return {
    id: `00000000-0000-4000-8000-${title.length.toString(16).padStart(12, '0')}`,
    type: 'login',
    title,
    favorite: false,
    username: 'usuario',
    password: 'secreto',
    urls: [...urls],
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('hostOf()', () => {
  it('extrae el host de una URL completa', () => {
    expect(hostOf('https://github.com/login?next=/x')).toBe('github.com');
  });

  it('acepta un host pelado, que es como lo escribe la gente', () => {
    expect(hostOf('github.com')).toBe('github.com');
  });

  it('normaliza mayúsculas y el punto final', () => {
    expect(hostOf('HTTPS://GitHub.COM.')).toBe('github.com');
  });

  it('ignora el puerto: la credencial vale en cualquiera', () => {
    expect(hostOf('https://localhost:8443/app')).toBe('localhost');
  });

  it.each(['file:///C:/passwords.txt', 'javascript:alert(1)', 'data:text/html,x', 'ftp://x.com'])(
    'rechaza %s por no ser web',
    (url) => {
      expect(hostOf(url)).toBeNull();
    },
  );

  it.each(['', '   ', 'https://', 'no es una url'])('rechaza la entrada inservible %j', (url) => {
    expect(hostOf(url)).toBeNull();
  });
});

describe('urlMatchesHost() — seguridad', () => {
  it('NO casa un dominio que sólo contiene al guardado como subcadena', () => {
    // El ataque más barato: registrar evil-github.com y esperar a que el gestor
    // compare con `includes` o `endsWith` sin frontera de etiqueta.
    expect(urlMatchesHost('github.com', 'evil-github.com')).toBe(false);
  });

  it('NO casa un dominio que lleva al guardado como prefijo de otro', () => {
    // github.com.attacker.net termina en attacker.net: es del atacante, no de GitHub.
    expect(urlMatchesHost('github.com', 'github.com.attacker.net')).toBe(false);
  });

  it('NO ofrece la credencial del subdominio en el dominio padre', () => {
    // Quien guardó la de la intranet fue específico. El padre puede ser una web pública.
    expect(urlMatchesHost('intranet.empresa.com', 'empresa.com')).toBe(false);
  });

  it('NO casa un sufijo suelto con todo lo que hay debajo', () => {
    expect(urlMatchesHost('com', 'github.com')).toBe(false);
  });

  it('NO casa dominios distintos que comparten el final', () => {
    expect(urlMatchesHost('banco.com', 'otrobanco.com')).toBe(false);
  });

  it('exige coincidencia exacta en direcciones IP', () => {
    // No existen subdominios de una IP: que 10.1.2.3 acabe en «.2.3» no significa nada.
    expect(urlMatchesHost('10.1.2.3', '10.1.2.3')).toBe(true);
    expect(urlMatchesHost('2.3', '10.1.2.3')).toBe(false);
  });
});

describe('urlMatchesHost() — lo que sí debe casar', () => {
  it('casa el dominio exacto', () => {
    expect(urlMatchesHost('https://github.com/login', 'github.com')).toBe(true);
  });

  it('casa un subdominio real del dominio guardado', () => {
    expect(urlMatchesHost('github.com', 'www.github.com')).toBe(true);
    expect(urlMatchesHost('github.com', 'gist.github.com')).toBe(true);
  });

  it('casa aunque la URL guardada traiga ruta y parámetros', () => {
    expect(urlMatchesHost('https://cuenta.banco.com/entrar?x=1#y', 'cuenta.banco.com')).toBe(true);
  });

  it('casa un host de una sola etiqueta consigo mismo', () => {
    // Intranets y desarrollo local. Se permite exacto, nunca por subdominio.
    expect(urlMatchesHost('localhost', 'localhost')).toBe(true);
    expect(urlMatchesHost('localhost', 'evil.localhost')).toBe(false);
  });
});

describe('findLoginsForUrl()', () => {
  const items: readonly VaultItem[] = [
    login('Empresa', ['empresa.com']),
    login('Intranet', ['intranet.empresa.com']),
    login('GitHub', ['github.com']),
    { ...login('Nota', []), type: 'note', body: 'x' } as unknown as VaultItem,
  ];

  it('devuelve sólo lo que aplica al host', () => {
    const found = findLoginsForUrl(items, 'https://github.com/login');
    expect(found.map((i) => i.title)).toEqual(['GitHub']);
  });

  it('ordena de lo más específico a lo más general', () => {
    // En la intranet valen las dos, pero la del subdominio se guardó aparte por algo.
    const found = findLoginsForUrl(items, 'https://intranet.empresa.com/');
    expect(found.map((i) => i.title)).toEqual(['Intranet', 'Empresa']);
  });

  it('en el dominio padre no aparece la del subdominio', () => {
    const found = findLoginsForUrl(items, 'https://empresa.com/');
    expect(found.map((i) => i.title)).toEqual(['Empresa']);
  });

  it('nunca devuelve items que no son credenciales', () => {
    // Una nota o una tarjeta no tienen nada que rellenar en un formulario de acceso.
    const found = findLoginsForUrl(items, 'https://empresa.com/');
    expect(found.every((i) => i.type === 'login')).toBe(true);
  });

  it('devuelve vacío en una página que no es web', () => {
    expect(findLoginsForUrl(items, 'file:///C:/x.html')).toEqual([]);
  });
});
