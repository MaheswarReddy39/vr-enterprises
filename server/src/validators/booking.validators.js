import { z } from 'zod';
import { BOOKING_STATUS } from '../models/Booking.js';
import { objectId, pagingQuery } from './common.js';

const text = (min, max, message) => z.string().trim().min(min, message).max(max);
const phone = z.string().trim().min(6, 'Enter a phone number.').max(20).regex(/^[0-9+()\-\s]+$/, 'Use digits, spaces, + ( ) or - only.');
const postalCode = z.string().trim().regex(/^[A-Za-z0-9 -]{3,10}$/, 'Enter a valid postal code.');

// Saved delivery addresses (a convenience on the account page; bookings carry their own copy).
export const addressBody = z.strictObject({
  label: text(0, 30).optional(),
  name: text(2, 80, 'Enter the recipient name.'),
  phone,
  line1: text(3, 120, 'Enter the street address.'),
  line2: text(0, 120).optional(),
  city: text(2, 60, 'Enter the city.'),
  state: text(2, 60, 'Enter the state.'),
  postalCode,
  isDefault: z.boolean().optional(),
});
export const addressUpdateBody = addressBody.partial();
export const addressParams = z.object({ addressId: objectId });

export const bookingBody = z.strictObject({
  name: text(2, 80, 'Enter your name.'),
  mobile: phone,
  address: z.strictObject({
    line1: text(3, 120, 'Enter the street address.'),
    line2: text(0, 120).optional(),
    city: text(2, 60, 'Enter the city.'),
    state: text(2, 60, 'Enter the state.'),
    postalCode,
  }),
  items: z.array(z.strictObject({ productId: objectId, quantity: z.number().int().min(1).max(10) })).min(1, 'Choose at least one product.').max(20),
  // True when the items come from the saved cart, which is then cleared of them after booking.
  fromCart: z.boolean().optional(),
});

export const bookingListQuery = z.object({ ...pagingQuery });

export const adminBookingListQuery = z.object({
  ...pagingQuery,
  q: z.string().trim().max(100).optional(),
  status: z.enum(BOOKING_STATUS).optional(),
  unread: z.enum(['true']).optional(),
  customer: objectId.optional(),
});

export const bookingStatusBody = z.strictObject({
  status: z.enum(['confirmed', 'processing', 'completed', 'rejected']),
  note: text(0, 300).optional(),
});

export const notificationListQuery = z.object({ ...pagingQuery, state: z.enum(['pending', 'sending', 'sent', 'failed', 'skipped']).optional(), booking: objectId.optional() });

export const readBody = z.strictObject({ isRead: z.boolean() });
