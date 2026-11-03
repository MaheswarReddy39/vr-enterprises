import { z } from 'zod';

const text = (max) => z.string().trim().max(max);

// Each section is optional and partial; unknown fields are rejected.
const business = z.strictObject({
  name: z.string().trim().min(2, 'Enter the business name.').max(100),
  tagline: text(120),
  address: text(500),
  phone: z.string().trim().max(30).regex(/^[0-9+()\-\s]*$/, 'Use digits, spaces, + ( ) or - only.'),
  email: z.string().trim().max(254).refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email address.'),
  hours: text(200),
  // Format only (15 letters/digits); the business supplies the real number. Nothing is checked against GST rules.
  gstin: z.string().trim().toUpperCase().refine((v) => v === '' || /^[0-9A-Z]{15}$/.test(v), 'A GSTIN has 15 letters and digits.'),
}).partial();

export const settingsBody = z.strictObject({ business: business.optional() });
