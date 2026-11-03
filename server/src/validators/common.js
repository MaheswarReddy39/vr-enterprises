import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
export const idParams = z.object({ id: objectId });
export const imageParams = z.object({ id: objectId, imageId: objectId });

export const pagingQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const boolString = z.enum(['true', 'false']).transform((v) => v === 'true');

/** Search text: trimmed, bounded, optional. */
export const searchText = z.string().trim().max(100).optional();

/** Turns "" / null form values into undefined so optional fields behave. */
export const blankToUndefined = (value) => (value === '' || value === null ? undefined : value);
