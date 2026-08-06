import { describe, expect, it } from 'vitest';
import { exportBackup, mergeBackup, readBackup } from '@/src/core/vault/backup';
import type { LoginItem, VaultItem } from '@/src/core/model/item';
import { TEST_COST } from './fakes';

const NOW = 1_700_000_000_000;
const PASSWORD = 'la contraseña del archivo';

function aLogin(overrides: Partial<LoginItem> = {}): LoginItem {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    type: 'login',
    title: 'GitHub',
    favorite: false,
    createdAt: 1,
    updatedAt: 100,
    username: 'sistemas',
    password: 'la-clave-guardada',
    urls: ['https://github.com'],
    ...overrides,
  };
}

describe('exportación', () => {
  it('hace round-trip completo', async () => {
    const items: VaultItem[] = [aLogin(), aLogin({ id: '00000000-0000-4000-8000-000000000002' })];

    const file = await exportBackup(items, PASSWORD, NOW, TEST_COST);
    const restored = await readBackup(file, PASSWORD);

    expect(restored.ok).toBe(true);
    if (restored.ok) expect(restored.value).toEqual(items);
  });

  it('el archivo no filtra nada legible', async () => {
    const file = await exportBackup(
      [
        aLogin({
          title: 'Banco Secreto',
          username: 'juan.perez',
          password: 'MiContraseñaSuperSecreta',
          urls: ['https://banco-secreto.example'],
        }),
      ],
      PASSWORD,
      NOW,
      TEST_COST,
    );

    const onDisk = JSON.stringify(file);
    expect(onDisk).not.toContain('Banco Secreto');
    expect(onDisk).not.toContain('juan.perez');
    expect(onDisk).not.toContain('MiContraseñaSuperSecreta');
    expect(onDisk).not.toContain('banco-secreto');
  });

  it('deja el número de items en claro, para poder comprobarlo antes de abrirlo', async () => {
    const file = await exportBackup([aLogin()], PASSWORD, NOW, TEST_COST);

    expect(file.itemCount).toBe(1);
    expect(file.format).toBe('password-vault-backup');
    expect(file.createdAt).toBe(NOW);
  });

  it('es autocontenido: lleva su propio salt', async () => {
    const a = await exportBackup([aLogin()], PASSWORD, NOW, TEST_COST);
    const b = await exportBackup([aLogin()], PASSWORD, NOW, TEST_COST);

    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.payload.ct).not.toBe(b.payload.ct);
  });
});

describe('importación', () => {
  it('rechaza la contraseña incorrecta', async () => {
    const file = await exportBackup([aLogin()], PASSWORD, NOW, TEST_COST);

    const restored = await readBackup(file, 'no es la contraseña');

    expect(restored.ok).toBe(false);
    if (!restored.ok) expect(restored.error.kind).toBe('wrong-password');
  });

  it('rechaza un archivo que no es un respaldo', async () => {
    for (const raw of [null, {}, 'texto', { format: 'otra-cosa' }, []]) {
      const restored = await readBackup(raw, PASSWORD);
      expect(restored.ok).toBe(false);
      if (!restored.ok) expect(restored.error.kind).toBe('not-a-backup');
    }
  });

  it('rechaza un respaldo de una versión futura', async () => {
    const file = await exportBackup([aLogin()], PASSWORD, NOW, TEST_COST);

    const restored = await readBackup({ ...file, version: 99 }, PASSWORD);

    expect(restored.ok).toBe(false);
    if (!restored.ok) expect(restored.error.kind).toBe('unsupported-backup-version');
  });

  it('detecta manipulación del payload', async () => {
    const file = await exportBackup([aLogin()], PASSWORD, NOW, TEST_COST);
    const tampered = {
      ...file,
      payload: { ...file.payload, ct: file.payload.ct.slice(0, -4) + 'AAAA' },
    };

    expect((await readBackup(tampered, PASSWORD)).ok).toBe(false);
  });
});

describe('fusión al importar', () => {
  const viejo = aLogin({ title: 'viejo', updatedAt: 100 });
  const nuevo = aLogin({ title: 'nuevo', updatedAt: 200 });
  const otro = aLogin({ id: '00000000-0000-4000-8000-000000000002', title: 'otro' });

  it('añade los que no existen', () => {
    const { items, report } = mergeBackup([viejo], [otro]);

    expect(items).toHaveLength(2);
    expect(report).toEqual({ added: 1, updated: 0, skipped: 0 });
  });

  it('actualiza cuando el respaldo trae una versión más reciente', () => {
    const { items, report } = mergeBackup([viejo], [nuevo]);

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('nuevo');
    expect(report).toEqual({ added: 0, updated: 1, skipped: 0 });
  });

  it('NO pisa un item que en la bóveda es más reciente que en el respaldo', () => {
    const { items, report } = mergeBackup([nuevo], [viejo]);

    expect(items[0]?.title).toBe('nuevo');
    expect(report).toEqual({ added: 0, updated: 0, skipped: 1 });
  });

  it('es idempotente: reimportar el mismo archivo no cambia nada', () => {
    const primera = mergeBackup([], [viejo, otro]);
    const segunda = mergeBackup(primera.items, [viejo, otro]);

    expect(segunda.items).toHaveLength(2);
    expect(segunda.report).toEqual({ added: 0, updated: 0, skipped: 2 });
  });

  it('deja el resultado ordenado por fecha de modificación', () => {
    const { items } = mergeBackup([], [viejo, otro, nuevo]);

    const fechas = items.map((i) => i.updatedAt);
    expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
  });
});
