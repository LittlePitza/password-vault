import { beforeEach, describe, expect, it } from 'vitest';
import { VaultRepository } from '@/src/core/vault/vaultRepository';
import { VaultService } from '@/src/core/vault/vaultService';
import { MIN_MASTER_PASSWORD_LENGTH } from '@/src/core/vault/masterPassword';
import type { ItemDraft } from '@/src/core/vault/vaultService';
import { FakeClock, FakeStorage, SequentialIds, TEST_COST } from './fakes';

const MASTER = 'una frase larga y memorable';

const loginDraft: ItemDraft = {
  type: 'login',
  title: 'GitHub',
  favorite: false,
  username: 'sistemas',
  password: 'la-clave-guardada',
  urls: ['https://github.com'],
};

describe('VaultService', () => {
  let storage: FakeStorage;
  let session: FakeStorage;
  let clock: FakeClock;
  let service: VaultService;

  beforeEach(() => {
    storage = new FakeStorage();
    session = new FakeStorage();
    clock = new FakeClock();
    service = new VaultService({
      repository: new VaultRepository(storage),
      session,
      clock,
      ids: new SequentialIds(),
      kdfCost: TEST_COST,
    });
  });

  describe('ciclo de vida', () => {
    it('arranca sin inicializar', async () => {
      expect((await service.snapshot()).status).toBe('uninitialized');
    });

    it('queda desbloqueada justo después de crearse', async () => {
      const created = await service.initialize(MASTER);

      expect(created.ok).toBe(true);
      expect((await service.snapshot()).status).toBe('unlocked');
    });

    it('no permite crear una segunda bóveda encima de la existente', async () => {
      await service.initialize(MASTER);

      const again = await service.initialize('otra frase larga distinta');

      expect(again.ok).toBe(false);
      if (!again.ok) expect(again.error.kind).toBe('already-initialized');
    });

    it('bloquear y desbloquear devuelve el mismo contenido', async () => {
      await service.initialize(MASTER);
      const created = await service.createItem(loginDraft);
      expect(created.ok).toBe(true);

      await service.lock();
      expect((await service.snapshot()).status).toBe('locked');

      const unlocked = await service.unlock(MASTER);
      expect(unlocked.ok).toBe(true);

      const snapshot = await service.snapshot();
      expect(snapshot.status).toBe('unlocked');
      expect(snapshot.items).toHaveLength(1);
      expect(snapshot.items[0]?.title).toBe('GitHub');
    });

    it('no desbloquea con la contraseña incorrecta', async () => {
      await service.initialize(MASTER);
      await service.lock();

      const attempt = await service.unlock('no es la maestra');

      expect(attempt.ok).toBe(false);
      if (!attempt.ok) expect(attempt.error.kind).toBe('wrong-password');
      expect((await service.snapshot()).status).toBe('locked');
    });

    it('no se puede desbloquear una bóveda que no existe', async () => {
      const attempt = await service.unlock(MASTER);

      expect(attempt.ok).toBe(false);
      if (!attempt.ok) expect(attempt.error.kind).toBe('not-initialized');
    });
  });

  describe('supervivencia a la muerte del service worker', () => {
    it('sigue desbloqueada cuando el worker revive, sin volver a pedir la maestra', async () => {
      await service.initialize(MASTER);
      await service.createItem(loginDraft);

      // Chrome mata el service worker: se pierde toda variable de módulo y se vuelve a
      // ejecutar background.ts entero. Se simula construyendo un servicio nuevo sobre el
      // MISMO almacenamiento — que es exactamente lo que sobrevive.
      const revived = new VaultService({
        repository: new VaultRepository(storage),
        session,
        clock,
        ids: new SequentialIds(),
      });

      const snapshot = await revived.snapshot();
      expect(snapshot.status).toBe('unlocked');
      expect(snapshot.items).toHaveLength(1);
    });

    it('queda bloqueada si además se cerró el navegador', async () => {
      await service.initialize(MASTER);

      // Cerrar el navegador vacía storage.session (sólo memoria) pero no storage.local.
      await session.clear();

      const revived = new VaultService({
        repository: new VaultRepository(storage),
        session,
        clock,
        ids: new SequentialIds(),
      });

      expect((await revived.snapshot()).status).toBe('locked');
    });

    it('trata una sesión corrupta como bloqueada en vez de fallar', async () => {
      await service.initialize(MASTER);
      await session.set('dek', 'esto-no-es-una-llave-valida');

      expect((await service.snapshot()).status).toBe('locked');
    });
  });

  describe('operaciones con la bóveda bloqueada', () => {
    beforeEach(async () => {
      await service.initialize(MASTER);
      await service.lock();
    });

    it('rechaza listar', async () => {
      const result = await service.listItems();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('locked');
    });

    it('rechaza crear', async () => {
      const result = await service.createItem(loginDraft);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('locked');
    });

    it('rechaza revelar un secreto', async () => {
      const result = await service.revealItem('00000000-0000-4000-8000-000000000001');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('locked');
    });

    it('rechaza borrar', async () => {
      const result = await service.deleteItem('00000000-0000-4000-8000-000000000001');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('locked');
    });
  });

  describe('CRUD', () => {
    beforeEach(async () => {
      await service.initialize(MASTER);
    });

    it('el resumen de la lista no incluye la contraseña', async () => {
      await service.createItem(loginDraft);

      const listed = await service.listItems();

      expect(listed.ok).toBe(true);
      if (!listed.ok) return;
      // La lista muestra usuario y título; el secreto sólo sale por revealItem().
      expect(JSON.stringify(listed.value)).not.toContain('la-clave-guardada');
      expect(listed.value[0]?.subtitle).toBe('sistemas');
    });

    it('revealItem sí devuelve el secreto completo', async () => {
      const created = await service.createItem(loginDraft);
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const revealed = await service.revealItem(created.value.id);

      expect(revealed.ok).toBe(true);
      if (revealed.ok && revealed.value.type === 'login') {
        expect(revealed.value.password).toBe('la-clave-guardada');
      }
    });

    it('actualizar refresca updatedAt pero conserva createdAt', async () => {
      const created = await service.createItem(loginDraft);
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      clock.advance(60_000);
      const updated = await service.updateItem({
        ...created.value,
        title: 'GitHub (trabajo)',
        // Un llamador malicioso o descuidado podría mandar otro createdAt: se ignora.
        createdAt: 999,
      });

      expect(updated.ok).toBe(true);
      if (!updated.ok) return;
      expect(updated.value.createdAt).toBe(created.value.createdAt);
      expect(updated.value.updatedAt).toBeGreaterThan(created.value.updatedAt);
      expect(updated.value.title).toBe('GitHub (trabajo)');
    });

    it('no actualiza un item inexistente', async () => {
      const created = await service.createItem(loginDraft);
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const result = await service.updateItem({
        ...created.value,
        id: '00000000-0000-4000-8000-999999999999',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('item-not-found');
    });

    it('borra', async () => {
      const created = await service.createItem(loginDraft);
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      await service.deleteItem(created.value.id);

      const listed = await service.listItems();
      expect(listed.ok && listed.value).toHaveLength(0);
    });
  });

  describe('cambio de contraseña maestra', () => {
    it('conserva los items y exige la nueva a partir de entonces', async () => {
      await service.initialize(MASTER);
      await service.createItem(loginDraft);

      const changed = await service.changeMasterPassword(MASTER, 'otra frase igual de larga');
      expect(changed.ok).toBe(true);

      await service.lock();
      expect((await service.unlock(MASTER)).ok).toBe(false);

      const unlocked = await service.unlock('otra frase igual de larga');
      expect(unlocked.ok).toBe(true);
      expect((await service.snapshot()).items).toHaveLength(1);
    });

    it('rechaza una contraseña nueva que no cumple la política', async () => {
      await service.initialize(MASTER);

      const changed = await service.changeMasterPassword(MASTER, 'corta');

      expect(changed.ok).toBe(false);
      if (!changed.ok) expect(changed.error.kind).toBe('weak-master-password');
    });
  });

  describe('recuperación con código de respaldo', () => {
    it('initialize devuelve el código, y sólo esa vez', async () => {
      const created = await service.initialize(MASTER);

      expect(created.ok).toBe(true);
      if (created.ok) {
        expect(created.value).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){5}$/);
      }
    });

    it('abre la bóveda cuando se ha olvidado la maestra', async () => {
      const created = await service.initialize(MASTER);
      if (!created.ok) throw new Error('no se creó la bóveda');
      await service.createItem(loginDraft);
      await service.lock();

      const recovered = await service.recoverWithCode(created.value);

      expect(recovered.ok).toBe(true);
      const snapshot = await service.snapshot();
      expect(snapshot.status).toBe('unlocked');
      expect(snapshot.items).toHaveLength(1);
    });

    it('deja marcado que falta fijar una contraseña nueva', async () => {
      const created = await service.initialize(MASTER);
      if (!created.ok) throw new Error('no se creó la bóveda');
      await service.lock();

      await service.recoverWithCode(created.value);

      expect((await service.snapshot()).pendingMasterReset).toBe(true);
    });

    it('completar la recuperación fija la maestra nueva y rota el código', async () => {
      const created = await service.initialize(MASTER);
      if (!created.ok) throw new Error('no se creó la bóveda');
      await service.lock();
      await service.recoverWithCode(created.value);

      const completed = await service.completeRecovery('la nueva frase maestra');
      expect(completed.ok).toBe(true);
      if (!completed.ok) return;

      expect((await service.snapshot()).pendingMasterReset).toBe(false);
      // El código nuevo es distinto y el viejo ya no vale.
      expect(completed.value).not.toBe(created.value);

      await service.lock();
      expect((await service.unlock('la nueva frase maestra')).ok).toBe(true);
      await service.lock();
      expect((await service.recoverWithCode(created.value)).ok).toBe(false);
      await service.lock();
      expect((await service.recoverWithCode(completed.value)).ok).toBe(true);
    });

    it('rechaza un código incorrecto', async () => {
      await service.initialize(MASTER);
      await service.lock();

      const attempt = await service.recoverWithCode('0000-0000-0000-0000-0000-0000');

      expect(attempt.ok).toBe(false);
      if (!attempt.ok) expect(attempt.error.kind).toBe('wrong-recovery-code');
      expect((await service.snapshot()).status).toBe('locked');
    });

    it('rechaza un código mal formado sin llegar a derivar la llave', async () => {
      await service.initialize(MASTER);
      await service.lock();

      const attempt = await service.recoverWithCode('esto-no-es-un-codigo');

      expect(attempt.ok).toBe(false);
      if (!attempt.ok) expect(attempt.error.kind).toBe('wrong-recovery-code');
    });

    it('rotar el código invalida el anterior pero no la maestra', async () => {
      const created = await service.initialize(MASTER);
      if (!created.ok) throw new Error('no se creó la bóveda');

      const rotated = await service.rotateRecoveryCode();
      expect(rotated.ok).toBe(true);
      if (!rotated.ok) return;

      await service.lock();
      expect((await service.unlock(MASTER)).ok).toBe(true);
      await service.lock();
      expect((await service.recoverWithCode(created.value)).ok).toBe(false);
      await service.lock();
      expect((await service.recoverWithCode(rotated.value)).ok).toBe(true);
    });

    it('no se puede rotar el código con la bóveda bloqueada', async () => {
      await service.initialize(MASTER);
      await service.lock();

      const rotated = await service.rotateRecoveryCode();

      expect(rotated.ok).toBe(false);
      if (!rotated.ok) expect(rotated.error.kind).toBe('locked');
    });
  });

  describe('respaldo del contenido', () => {
    it('exporta e importa de vuelta sobre una bóveda vacía', async () => {
      await service.initialize(MASTER);
      await service.createItem(loginDraft);

      const exported = await service.exportBackup('clave del archivo');
      expect(exported.ok).toBe(true);
      if (!exported.ok) return;

      // Bóveda nueva, como tras formatear el equipo.
      const fresh = new VaultService({
        repository: new VaultRepository(new FakeStorage()),
        session: new FakeStorage(),
        clock,
        ids: new SequentialIds(),
        kdfCost: TEST_COST,
      });
      await fresh.initialize('otra frase larga distinta');

      const imported = await fresh.importBackup(exported.value, 'clave del archivo');
      expect(imported.ok).toBe(true);
      if (imported.ok) expect(imported.value).toEqual({ added: 1, updated: 0, skipped: 0 });

      const listed = await fresh.listItems();
      expect(listed.ok && listed.value).toHaveLength(1);
    });

    it('reimportar el mismo archivo no duplica nada', async () => {
      await service.initialize(MASTER);
      await service.createItem(loginDraft);
      const exported = await service.exportBackup('clave del archivo');
      if (!exported.ok) throw new Error('no se exportó');

      const again = await service.importBackup(exported.value, 'clave del archivo');

      expect(again.ok).toBe(true);
      if (again.ok) expect(again.value).toEqual({ added: 0, updated: 0, skipped: 1 });
      const listed = await service.listItems();
      expect(listed.ok && listed.value).toHaveLength(1);
    });

    it('rechaza la contraseña incorrecta del archivo', async () => {
      await service.initialize(MASTER);
      const exported = await service.exportBackup('clave del archivo');
      if (!exported.ok) throw new Error('no se exportó');

      const imported = await service.importBackup(exported.value, 'clave equivocada');

      expect(imported.ok).toBe(false);
      if (!imported.ok) expect(imported.error.kind).toBe('wrong-password');
    });

    it('no exporta con la bóveda bloqueada', async () => {
      await service.initialize(MASTER);
      await service.lock();

      const exported = await service.exportBackup('clave del archivo');

      expect(exported.ok).toBe(false);
      if (!exported.ok) expect(exported.error.kind).toBe('locked');
    });
  });

  describe('política de la contraseña maestra', () => {
    it('rechaza las demasiado cortas', async () => {
      const result = await service.initialize('a'.repeat(MIN_MASTER_PASSWORD_LENGTH - 1));

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('weak-master-password');
    });

    it('rechaza las de muy poca variedad, aunque sean largas', async () => {
      const result = await service.initialize('aaaaaaaaaaaaaaaaaaaa');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('weak-master-password');
    });

    it('rechaza las obviamente comunes', async () => {
      const result = await service.initialize('passwordpassword');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('weak-master-password');
    });

    it('acepta una frase larga y variada', async () => {
      expect((await service.initialize('el perro corre por el parque')).ok).toBe(true);
    });
  });
});
