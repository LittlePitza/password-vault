import { beforeEach, describe, expect, it } from 'vitest';
import { generateAesKey } from '@/src/core/crypto/aes';
import { STORAGE_KEYS, VaultRepository } from '@/src/core/vault/vaultRepository';
import type { CardItem, LoginItem, NoteItem } from '@/src/core/model/item';
import { FakeStorage, SequentialIds } from './fakes';

const ids = new SequentialIds();

function aLogin(overrides: Partial<LoginItem> = {}): LoginItem {
  return {
    id: ids.newId(),
    type: 'login',
    title: 'GitHub',
    favorite: false,
    createdAt: 1,
    updatedAt: 1,
    username: 'sistemas@plasticospimsa.com',
    password: 'hunter2-pero-de-verdad',
    urls: ['https://github.com'],
    ...overrides,
  };
}

describe('VaultRepository', () => {
  let storage: FakeStorage;
  let repo: VaultRepository;
  let dek: CryptoKey;

  beforeEach(async () => {
    storage = new FakeStorage();
    repo = new VaultRepository(storage);
    dek = await generateAesKey();
  });

  it('guarda y recupera un item intacto', async () => {
    const item = aLogin();

    await repo.saveItem(dek, item);
    const loaded = await repo.readItem(dek, item.id);

    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.value).toEqual(item);
  });

  it('guarda los tres tipos de item', async () => {
    const note: NoteItem = {
      id: ids.newId(),
      type: 'note',
      title: 'Claves del router',
      favorite: false,
      createdAt: 1,
      updatedAt: 2,
      body: 'admin / 1234',
    };
    const card: CardItem = {
      id: ids.newId(),
      type: 'card',
      title: 'Visa personal',
      favorite: true,
      createdAt: 1,
      updatedAt: 3,
      cardholder: 'Nombre Apellido',
      number: '4111111111111111',
      expMonth: '09',
      expYear: '2030',
      cvv: '123',
    };

    await repo.saveItem(dek, aLogin());
    await repo.saveItem(dek, note);
    await repo.saveItem(dek, card);

    const { items, damaged } = await repo.loadAll(dek);

    expect(damaged).toEqual([]);
    expect(items.map((i) => i.type).sort()).toEqual(['card', 'login', 'note']);
  });

  it('ordena por fecha de modificación descendente', async () => {
    await repo.saveItem(dek, aLogin({ title: 'antiguo', updatedAt: 100 }));
    await repo.saveItem(dek, aLogin({ title: 'reciente', updatedAt: 300 }));
    await repo.saveItem(dek, aLogin({ title: 'intermedio', updatedAt: 200 }));

    const { items } = await repo.loadAll(dek);

    expect(items.map((i) => i.title)).toEqual(['reciente', 'intermedio', 'antiguo']);
  });

  it('aparta los registros dañados sin perder el resto de la bóveda', async () => {
    const sano = aLogin({ title: 'sobrevive' });
    await repo.saveItem(dek, sano);
    // Un registro cifrado con otra llave: imita corrupción en disco.
    await repo.saveItem(await generateAesKey(), aLogin({ title: 'ilegible' }));

    const { items, damaged } = await repo.loadAll(dek);

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('sobrevive');
    expect(damaged).toHaveLength(1);
    expect(damaged[0]?.error.kind).toBe('corrupt-data');
  });

  it('borra un item', async () => {
    const item = aLogin();
    await repo.saveItem(dek, item);

    await repo.deleteItem(item.id);

    const { items } = await repo.loadAll(dek);
    expect(items).toEqual([]);
  });

  it('informa si la bóveda aún no está inicializada', async () => {
    expect(await repo.isInitialized()).toBe(false);
  });
});

describe('lo que queda escrito en disco', () => {
  it('no filtra ni el título, ni el usuario, ni la URL, ni la contraseña', async () => {
    const storage = new FakeStorage();
    const repo = new VaultRepository(storage);
    const dek = await generateAesKey();

    await repo.saveItem(
      dek,
      aLogin({
        title: 'Banco Secreto',
        username: 'juan.perez',
        password: 'MiContraseñaSuperSecreta',
        urls: ['https://banco-secreto.example'],
      }),
    );

    // Este es el test que respalda la comprobación manual del plan: abrir DevTools y
    // confirmar que en chrome.storage.local no hay una sola cadena legible.
    const onDisk = storage.dump();
    expect(onDisk).not.toContain('Banco Secreto');
    expect(onDisk).not.toContain('juan.perez');
    expect(onDisk).not.toContain('MiContraseñaSuperSecreta');
    expect(onDisk).not.toContain('banco-secreto');
    // Sólo la clave de almacenamiento revela que existe *un* item, no cuál.
    expect(onDisk).toContain(STORAGE_KEYS.ITEM_PREFIX);
  });
});
