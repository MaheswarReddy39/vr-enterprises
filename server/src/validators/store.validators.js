import { z } from 'zod';
import { ENQUIRY_STATUS } from '../models/Enquiry.js';
import { boolString, objectId, pagingQuery } from './common.js';

const key = z.string().regex(/^[a-z0-9-]{1,100}$/i, 'Invalid identifier');

export const storeListQuery = z.object({
  page: pagingQuery.page,
  limit: z.coerce.number().int().min(1).max(48).default(12),
  q: z.string().trim().max(80).optional(),
  category: key.optional(),
  featured: boolString.optional(),
  sort: z.enum(['featured', 'newest', 'price_asc', 'price_desc', 'name']).default('featured'),
});

export const storeKeyParams = z.object({ key });

export const relatedQuery = z.object({ limit: z.coerce.number().int().min(1).max(12).default(4) });

export const enquiryBody = z.strictObject({
  name: z.string().trim().min(2, 'Please enter your name.').max(100),
  email: z.string().trim().email('Please enter a valid email address.').max(254),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9+()\-\s]*$/, 'Use digits, spaces, + ( ) or - only.')
    .optional(),
  message: z.string().trim().min(10, 'Please write at least 10 characters.').max(2000),
  product: objectId.optional(),
  // Honeypot: real visitors never see or fill this field; bots usually do.
  website: z.string().max(200).optional(),
});

export const adminEnquiryListQuery = z.object({
  ...pagingQuery,
  status: z.enum(ENQUIRY_STATUS).optional(),
});

export const enquiryStatusBody = z.strictObject({ status: z.enum(ENQUIRY_STATUS) });
