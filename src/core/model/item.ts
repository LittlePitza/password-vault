import { z } from 'zod';

/**
 * Modelo de datos de la bóveda.
 *
 * Los tipos se **infieren** de los esquemas zod en vez de declararse aparte: así no
 * pueden desincronizarse. El esquema no es decoración — se ejecuta al descifrar cada
 * item (ver `vault/itemCodec.ts`).
 *
 * Por qué validar algo que acabamos de descifrar: AES-GCM garantiza que el dato es
 * auténtico y no fue manipulado, pero no que tenga la *forma* esperada. Una bóveda
 * escrita por una versión anterior de la extensión, o un registro truncado, deben fallar
 * de forma ruidosa y no propagar `undefined` por toda la aplicación.
 */

export const ITEM_TYPES = ['login', 'note', 'card'] as const;

const baseFields = {
  id: z.uuid(),
  title: z.string().min(1, 'El título no puede estar vacío').max(200),
  favorite: z.boolean(),
  folderId: z.uuid().optional(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
};

export const loginItemSchema = z.object({
  ...baseFields,
  type: z.literal('login'),
  username: z.string().max(500),
  password: z.string().max(1000),
  /** Dominios donde aplica esta credencial. Alimenta el matching del autocompletado. */
  urls: z.array(z.string().max(2000)).max(50),
  notes: z.string().max(10_000).optional(),
});

export const noteItemSchema = z.object({
  ...baseFields,
  type: z.literal('note'),
  body: z.string().max(50_000),
});

export const cardItemSchema = z.object({
  ...baseFields,
  type: z.literal('card'),
  cardholder: z.string().max(200),
  number: z.string().max(40),
  expMonth: z.string().regex(/^(0[1-9]|1[0-2])$/, 'Mes inválido (01-12)'),
  expYear: z.string().regex(/^\d{4}$/, 'Año inválido (AAAA)'),
  cvv: z.string().max(8),
  brand: z.string().max(40).optional(),
  notes: z.string().max(10_000).optional(),
});

export const vaultItemSchema = z.discriminatedUnion('type', [
  loginItemSchema,
  noteItemSchema,
  cardItemSchema,
]);

export type ItemType = (typeof ITEM_TYPES)[number];
export type LoginItem = z.infer<typeof loginItemSchema>;
export type NoteItem = z.infer<typeof noteItemSchema>;
export type CardItem = z.infer<typeof cardItemSchema>;
export type VaultItem = z.infer<typeof vaultItemSchema>;

/** Campos comunes a todo item, para listados y búsqueda. */
export type ItemSummary = Pick<VaultItem, 'id' | 'type' | 'title' | 'favorite' | 'updatedAt'> & {
  readonly subtitle: string;
};

export function toSummary(item: VaultItem): ItemSummary {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    favorite: item.favorite,
    updatedAt: item.updatedAt,
    subtitle: subtitleFor(item),
  };
}

/** Línea secundaria de la lista: identifica el item sin revelar el secreto. */
function subtitleFor(item: VaultItem): string {
  switch (item.type) {
    case 'login':
      return item.username;
    case 'note':
      return 'Nota segura';
    case 'card':
      return maskCardNumber(item.number);
  }
}

export function maskCardNumber(number: string): string {
  const digits = number.replace(/\D/g, '');
  return digits.length <= 4 ? '••••' : `•••• ${digits.slice(-4)}`;
}
