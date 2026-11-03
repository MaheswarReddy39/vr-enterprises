import { z } from 'zod';
import { MAX_STOCK, STOCK_ADJUSTMENT_TYPES, STOCK_REASONS } from '../constants/catalog.js';
import { objectId, pagingQuery } from './common.js';

export const adjustStockBody = z.strictObject({
  type: z.enum(STOCK_ADJUSTMENT_TYPES),
  // "set" may be 0; add/remove must change something (checked below).
  quantity: z.number({ error: 'Enter a whole number.' }).int('Enter a whole number.').min(0).max(MAX_STOCK),
  reason: z.enum(STOCK_REASONS),
  note: z.string().trim().max(500).optional(),
})
  .refine((v) => v.type === 'set' || v.quantity > 0, { path: ['quantity'], message: 'Quantity must be at least 1.' });

export const inventoryLogQuery = z.object({
  ...pagingQuery,
  product: objectId.optional(),
});
