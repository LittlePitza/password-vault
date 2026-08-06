import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { BrowserVaultStorage } from '@/src/platform/browserStorage';
import { BrowserSessionStore } from '@/src/platform/browserSession';
import { VaultRepository } from '@/src/core/vault/vaultRepository';
import { VaultService } from '@/src/core/vault/vaultService';
import { cryptoIdGenerator, systemClock } from '@/src/core/ports';
import { STORAGE_KEYS } from '@/src/core/vault/vaultRepository';
import { TEST_COST } from '../unit/fakes';

/**
 * Los adaptadores de `platform/`, probados contra la implementación en memoria de las
 * APIs de extensión que trae WXT.
 *
 * Los tests del núcleo usan dobles escritos a mano, que son rápidos pero podrían no
 * reflejar el comportamiento real de `browser.storage`. Estos cierran ese hueco:
 * ejercitan el código que de verdad se ejecutará dentro de Edge.
 */

describe('BrowserVaultStorage', () => {
  let storage: BrowserVaultStorage;

  beforeEach(() => {
    fakeBrowser.reset();
    storage = new BrowserVaultStorage();
  });

  it('guarda y recupera un valor', async () => {
    await storage.set('clave', { a: 1 });
    expect(await storage.get('clave')).toEqual({ a: 1 });
  });

  it('devuelve null para una clave inexistente', async () => {
    expect(await storage.get('no-existe')).toBeNull();
  });

  it('borra', async () => {
    await storage.set('clave', 'valor');
    await storage.remove('clave');
    expect(await storage.get('clave')).toBeNull();
  });

  it('filtra por prefijo y devuelve las claves ordenadas', async () => {
    await storage.set('vault:item:b', 1);
    await storage.set('vault:item:a', 2);
    await storage.set('settings', 3);

    expect(await storage.keysWithPrefix('vault:item:')).toEqual(['vault:item:a', 'vault:item:b']);
  });

  it('getMany con lista vacía no llama al navegador ni falla', async () => {
    expect(await storage.getMany([])).toEqual({});
  });

  it('getMany trae varias claves de una vez', async () => {
    await storage.set('a', 1);
    await storage.set('b', 2);

    expect(await storage.getMany(['a', 'b'])).toEqual({ a: 1, b: 2 });
  });
});

describe('BrowserSessionStore', () => {
  let session: BrowserSessionStore;

  beforeEach(() => {
    fakeBrowser.reset();
    session = new BrowserSessionStore();
  });

  it('guarda y recupera', async () => {
    await session.set('dek', 'llave-en-base64');
    expect(await session.get('dek')).toBe('llave-en-base64');
  });

  it('clear() la vacía por completo — es lo que hace el bloqueo', async () => {
    await session.set('dek', 'llave-en-base64');

    await session.clear();

    expect(await session.get('dek')).toBeNull();
  });

  it('vive en un área separada de storage.local', async () => {
    await session.set('dek', 'llave-en-base64');

    // Lo que va a sesión NO debe acabar en disco. Son áreas distintas del navegador y
    // de ahí depende toda la garantía de que la llave nunca se persiste.
    const onDisk = await new BrowserVaultStorage().get('dek');
    expect(onDisk).toBeNull();
  });
});

describe('integración completa sobre las APIs del navegador', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  function buildService() {
    return new VaultService({
      repository: new VaultRepository(new BrowserVaultStorage()),
      session: new BrowserSessionStore(),
      clock: systemClock,
      ids: cryptoIdGenerator,
      kdfCost: TEST_COST,
    });
  }

  it('crea, guarda, bloquea y desbloquea usando storage real', async () => {
    const service = buildService();

    expect((await service.initialize('una frase larga y memorable')).ok).toBe(true);
    expect(
      (
        await service.createItem({
          type: 'login',
          title: 'Edge',
          favorite: false,
          username: 'usuario',
          password: 'secreto-que-no-debe-verse',
          urls: ['https://example.com'],
        })
      ).ok,
    ).toBe(true);

    await service.lock();
    expect((await service.snapshot()).status).toBe('locked');

    expect((await service.unlock('una frase larga y memorable')).ok).toBe(true);
    expect((await service.snapshot()).items).toHaveLength(1);
  });

  it('el service worker muere y la bóveda sigue desbloqueada', async () => {
    const service = buildService();
    await service.initialize('una frase larga y memorable');
    await service.createItem({
      type: 'note',
      title: 'Nota',
      favorite: false,
      body: 'contenido',
    });

    // Chrome/Edge matan el worker: se re-ejecuta background.ts y se pierde todo estado
    // en memoria. Sobreviven storage.local y storage.session, que es de donde se
    // rehidrata el servicio nuevo.
    const revived = buildService();

    const snapshot = await revived.snapshot();
    expect(snapshot.status).toBe('unlocked');
    expect(snapshot.items).toHaveLength(1);
  });

  it('nada legible queda en storage.local', async () => {
    const service = buildService();
    await service.initialize('una frase larga y memorable');
    await service.createItem({
      type: 'login',
      title: 'Banco Secreto',
      favorite: false,
      username: 'juan.perez',
      password: 'MiContraseñaSuperSecreta',
      urls: ['https://banco-secreto.example'],
    });

    // Equivale a abrir DevTools en Edge e inspeccionar el almacenamiento de la extensión.
    const everything = JSON.stringify(await fakeBrowser.storage.local.get(null));

    expect(everything).not.toContain('Banco Secreto');
    expect(everything).not.toContain('juan.perez');
    expect(everything).not.toContain('MiContraseñaSuperSecreta');
    expect(everything).not.toContain('banco-secreto');
    expect(everything).toContain(STORAGE_KEYS.META_KEY);
  });

  it('la llave nunca se escribe en storage.local, sólo en session', async () => {
    const service = buildService();
    await service.initialize('una frase larga y memorable');

    const disk = JSON.stringify(await fakeBrowser.storage.local.get(null));
    const session = JSON.stringify(await fakeBrowser.storage.session.get(null));

    expect(session).toContain('dek');
    expect(disk).not.toContain('"dek"');
  });
});
