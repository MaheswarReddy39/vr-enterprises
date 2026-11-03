import { z } from 'zod';
import { pagingQuery } from './common.js';

export const customerListQuery = z.object({
  ...pagingQuery,
  q: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const customerStatusBody = z.strictObject({ isActive: z.boolean() });
