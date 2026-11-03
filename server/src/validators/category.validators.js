import { z } from 'zod';
import { boolString, objectId, pagingQuery, searchText } from './common.js';

const name = z.string().trim().min(2, 'Name must be at least 2 characters.').max(80);
const description = z.string().trim().max(1000);

export const categoryCreateBody = z.strictObject({
  name,
  description: description.optional(),
  parent: objectId.nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(-9999).max(9999).optional(),
});

export const categoryUpdateBody = categoryCreateBody.partial();

export const categoryListQuery = z.object({
  ...pagingQuery,
  q: searchText,
  active: boolString.optional(),
});

export const brandCreateBody = z.strictObject({
  name,
  description: description.optional(),
  isActive: z.boolean().optional(),
});

export const brandUpdateBody = brandCreateBody.partial();

export const brandListQuery = categoryListQuery;
