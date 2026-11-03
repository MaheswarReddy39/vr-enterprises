import { z } from 'zod';
import { MAX_IMAGES_PER_PRODUCT, MAX_STOCK, PRODUCT_STATUS_VALUES } from '../constants/catalog.js';
import { blankToUndefined, boolString, objectId, pagingQuery, searchText } from './common.js';

export const SKU_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,38}[A-Z0-9]$/;

export const sku = z
  .string()
  .trim()
  .toUpperCase()
  .regex(SKU_PATTERN, 'SKU must be 3-40 characters: letters, numbers and hyphens only.');

const money = z
  .number({ error: 'Enter a valid amount.' })
  .min(0, 'Amount cannot be negative.')
  .max(10_000_000, 'Amount is too large.')
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Use at most 2 decimal places.');

const specItem = z.strictObject({
  label: z.string().trim().min(1, 'Label is required.').max(80),
  value: z.string().trim().min(1, 'Value is required.').max(300),
});

const specGroup = z.strictObject({
  group: z.string().trim().max(80).default(''),
  items: z.array(specItem).min(1, 'A group needs at least one specification.').max(50),
});

export const specifications = z
  .array(specGroup)
  .max(20)
  .superRefine((groups, ctx) => {
    let total = 0;
    groups.forEach((g, gi) => {
      const seen = new Set();
      g.items.forEach((item, ii) => {
        total += 1;
        const key = item.label.toLowerCase();
        if (seen.has(key)) {
          ctx.addIssue({ code: 'custom', path: [gi, 'items', ii, 'label'], message: `Duplicate label "${item.label}" in this group.` });
        }
        seen.add(key);
      });
    });
    if (total > 150) ctx.addIssue({ code: 'custom', message: 'Too many specifications (max 150).' });
  });

// NOTE: no schema-level defaults here. They would also fire on partial updates (PATCH) and silently
// reset fields; defaults live in the Mongoose model instead.
const shape = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(200),
  sku: z.preprocess(blankToUndefined, sku.optional()),
  category: objectId,
  brand: objectId.nullable(),
  shortDescription: z.string().trim().max(300),
  description: z.string().trim().max(10000),
  price: money,
  mrp: money.nullable(),
  lowStockThreshold: z.number().int().min(0).max(MAX_STOCK),
  status: z.enum(PRODUCT_STATUS_VALUES),
  isFeatured: z.boolean(),
  features: z.array(z.string().trim().min(1).max(200)).max(20),
  specifications,
};

const mrpNotBelowPrice = (data, ctx) => {
  if (data.price != null && data.mrp != null && data.mrp < data.price) {
    ctx.addIssue({ code: 'custom', path: ['mrp'], message: 'MRP cannot be lower than the selling price.' });
  }
};

const optionalFields = ['sku', 'brand', 'shortDescription', 'description', 'mrp', 'lowStockThreshold', 'status', 'isFeatured', 'features', 'specifications'];
const createShape = Object.fromEntries(
  Object.entries(shape).map(([key, schema]) => [key, optionalFields.includes(key) ? schema.optional() : schema]),
);

// Unknown keys (images, slug, role, createdBy, ...) are rejected, not ignored.
export const productCreateBody = z
  .strictObject({ ...createShape, stock: z.number().int().min(0).max(MAX_STOCK).optional() })
  .superRefine(mrpNotBelowPrice);

// Stock is deliberately absent: it can only change through the inventory endpoints.
export const productUpdateBody = z.strictObject(shape).partial().superRefine(mrpNotBelowPrice);

export const productListQuery = z.object({
  ...pagingQuery,
  q: searchText,
  status: z.enum(PRODUCT_STATUS_VALUES).optional(),
  category: objectId.optional(),
  brand: objectId.optional(),
  featured: boolString.optional(),
  stock: z.enum(['in', 'low', 'out']).optional(),
  sort: z.enum(['newest', 'oldest', 'name', 'price_asc', 'price_desc', 'stock_asc', 'updated']).default('newest'),
});

export const imageOrderBody = z.strictObject({
  order: z.array(objectId).min(1).max(MAX_IMAGES_PER_PRODUCT),
});
