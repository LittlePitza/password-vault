import { describe, expect, it } from 'vitest';
import { requestSchema } from '@/src/messaging/protocol';

/**
 * El service worker valida con este esquema todo lo que le llega. El content script se
 * ejecuta dentro de páginas potencialmente hostiles, así que el receptor no puede fiarse
 * de la forma de un mensaje sólo porque venga de la propia extensión.
 */
describe('validación del protocolo de mensajes', () => {
  it('acepta las peticiones bien formadas', () => {
    const valid: unknown[] = [
      { type: 'vault/snapshot' },
      { type: 'vault/unlock', masterPassword: 'una frase larga' },
      { type: 'vault/lock' },
      { type: 'vault/reveal', id: '00000000-0000-4000-8000-000000000001' },
      {
        type: 'vault/create',
        draft: {
          type: 'login',
          title: 'Ejemplo',
          favorite: false,
          username: 'u',
          password: 'p',
          urls: ['https://ejemplo.com'],
        },
      },
    ];

    for (const message of valid) {
      expect(requestSchema.safeParse(message).success).toBe(true);
    }
  });

  it('rechaza lo que no tiene la forma esperada', () => {
    const invalid: unknown[] = [
      null,
      undefined,
      'vault/unlock',
      42,
      {},
      { type: 'vault/borrar-todo' },
      { type: 'vault/unlock' }, // falta masterPassword
      { type: 'vault/reveal', id: 'no-es-un-uuid' },
      { type: 'vault/create', draft: { type: 'login' } }, // draft incompleto
      { type: 'vault/create', draft: { type: 'cripto-wallet', title: 'x' } },
    ];

    for (const message of invalid) {
      expect(requestSchema.safeParse(message).success).toBe(false);
    }
  });

  it('no deja colar id/createdAt/updatedAt en un draft: los pone el sistema', () => {
    const result = requestSchema.safeParse({
      type: 'vault/create',
      draft: {
        type: 'note',
        title: 'Nota',
        favorite: false,
        body: 'contenido',
        id: '00000000-0000-4000-8000-000000000001',
        createdAt: 1,
        updatedAt: 1,
      },
    });

    expect(result.success).toBe(true);
    if (result.success && result.data.type === 'vault/create') {
      expect(result.data.draft).not.toHaveProperty('id');
      expect(result.data.draft).not.toHaveProperty('createdAt');
    }
  });
});
