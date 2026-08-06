import { beforeEach, describe, expect, it } from 'vitest';
import { VaultRepository } from '@/src/core/vault/vaultRepository';
import { VaultService } from '@/src/core/vault/vaultService';
import type { ItemDraft } from '@/src/core/vault/vaultService';
import { FakeClock, FakeStorage, SequentialIds, TEST_COST } from './fakes';

/**
 * Los casos de uso del autocompletado.
 *
 * `urlMatch.test.ts` prueba la regla de dominios en aislamiento; esto prueba que el
 * servicio la aplica donde importa — al entregar el secreto— y no sólo al listar.
 */

const MASTER = 'una frase larga y memorable';

const gitHub: ItemDraft = {
  type: 'login',
  title: 'GitHub',
  favorite: false,
  username: 'sistemas',
  password: 'la-clave-de-github',
  urls: ['https://github.com'],
};

const banco: ItemDraft = {
  type: 'login',
  title: 'Banco',
  favorite: false,
  username: 'titular',
  password: 'la-clave-del-banco',
  urls: ['https://mi-banco.com'],
};

const nota: ItemDraft = {
  type: 'note',
  title: 'Nota',
  favorite: false,
  body: 'contenido',
};

describe('autocompletado', () => {
  let service: VaultService;

  beforeEach(async () => {
    service = new VaultService({
      repository: new VaultRepository(new FakeStorage()),
      session: new FakeStorage(),
      clock: new FakeClock(),
      ids: new SequentialIds(),
      kdfCost: TEST_COST,
    });
    await service.initialize(MASTER);
  });

  describe('candidatos', () => {
    it('devuelve sólo lo que aplica a la página', async () => {
      await service.createItem(gitHub);
      await service.createItem(banco);

      const result = await service.autofillCandidates('https://github.com/login');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.map((c) => c.title)).toEqual(['GitHub']);
    });

    it('NUNCA incluye la contraseña', async () => {
      // Esta lista se dibuja dentro de una página que no controlamos.
      await service.createItem(gitHub);

      const result = await service.autofillCandidates('https://github.com/login');

      expect(JSON.stringify(result)).not.toContain('la-clave-de-github');
    });

    it('no devuelve nada con la bóveda bloqueada', async () => {
      await service.createItem(gitHub);
      await service.lock();

      const result = await service.autofillCandidates('https://github.com/login');

      expect(result.ok).toBe(false);
    });

    it('devuelve vacío en un dominio parecido pero distinto', async () => {
      await service.createItem(gitHub);

      const result = await service.autofillCandidates('https://evil-github.com/login');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual([]);
    });
  });

  describe('entrega del secreto', () => {
    it('entrega la credencial en su propio dominio', async () => {
      const created = await service.createItem(gitHub);
      if (!created.ok) throw new Error('no se pudo crear');

      const result = await service.autofillCredential(created.value.id, 'https://github.com/login');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ username: 'sistemas', password: 'la-clave-de-github' });
      }
    });

    it('NO entrega la credencial del banco a otra página que pida su id', async () => {
      /*
       * El ataque central del autocompletado. El content script corre en una página
       * hostil y conoce —o adivina— el id de una credencial. Pedirlo desde su propia
       * página no debe servir de nada: el emparejamiento se comprueba al entregar, no
       * sólo al listar.
       */
      const created = await service.createItem(banco);
      if (!created.ok) throw new Error('no se pudo crear');

      const result = await service.autofillCredential(created.value.id, 'https://atacante.com/');

      expect(result.ok).toBe(false);
    });

    it('responde igual que si el item no existiera', async () => {
      // Distinguir «existe pero no es tuya» de «no existe» ya filtraría parte de la
      // bóveda: diría a una página qué credenciales tiene guardadas el usuario.
      const created = await service.createItem(banco);
      if (!created.ok) throw new Error('no se pudo crear');

      const ajena = await service.autofillCredential(created.value.id, 'https://atacante.com/');
      const inexistente = await service.autofillCredential(
        '00000000-0000-4000-8000-ffffffffffff',
        'https://atacante.com/',
      );

      expect(ajena.ok).toBe(false);
      expect(inexistente.ok).toBe(false);
      if (!ajena.ok && !inexistente.ok) {
        expect(ajena.error.kind).toBe(inexistente.error.kind);
      }
    });

    it('NO entrega nada desde una página que no es web', async () => {
      const created = await service.createItem(gitHub);
      if (!created.ok) throw new Error('no se pudo crear');

      const result = await service.autofillCredential(created.value.id, 'file:///C:/x.html');

      expect(result.ok).toBe(false);
    });

    it('NO entrega nada con la bóveda bloqueada', async () => {
      const created = await service.createItem(gitHub);
      if (!created.ok) throw new Error('no se pudo crear');
      await service.lock();

      const result = await service.autofillCredential(created.value.id, 'https://github.com/login');

      expect(result.ok).toBe(false);
    });

    it('no entrega notas ni tarjetas: no hay formulario que rellenar', async () => {
      const created = await service.createItem(nota);
      if (!created.ok) throw new Error('no se pudo crear');

      const result = await service.autofillCredential(created.value.id, 'https://github.com/login');

      expect(result.ok).toBe(false);
    });
  });
});
