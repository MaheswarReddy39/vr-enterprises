import { z } from 'zod';
import { objectId } from './common.js';

const phone = z
  .string()
  .trim()
  .max(20)
  .regex(/^[0-9+()\-\s]*$/, 'Use digits, spaces, + ( ) or - only.');

export const registerBody = z.strictObject({
  name: z.string().trim().min(2, 'Please enter your name.').max(80),
  email: z.string().trim().email('Please enter a valid email address.').max(254),
  password: z.string().min(1, 'Please choose a password.').max(200),
  phone: phone.optional(),
});

export const profileBody = z.strictObject({
  name: z.string().trim().min(2, 'Please enter your name.').max(80).optional(),
  phone: phone.optional(),
});

export const changePasswordBody = z.strictObject({
  currentPassword: z.string().min(1, 'Enter your current password.').max(200),
  newPassword: z.string().min(1, 'Choose a new password.').max(200),
});

const line = z.strictObject({ productId: objectId, quantity: z.number().int().min(1).max(10) });

export const cartQuoteBody = z.strictObject({ items: z.array(line).max(20) });
export const cartMergeBody = cartQuoteBody;
export const cartItemParams = z.object({ productId: objectId });
export const cartItemBody = z.strictObject({ quantity: z.number({ error: 'Enter a whole number.' }).int().min(0).max(10) });

export const lookupBody = z.strictObject({ ids: z.array(objectId).max(48) });
export const wishlistMergeBody = z.strictObject({ ids: z.array(objectId).max(100) });
