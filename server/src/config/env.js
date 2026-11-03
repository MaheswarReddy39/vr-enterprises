import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Variables that are already set in the process (hosting platform, shell) win over .env.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Empty strings in .env (e.g. `JWT_ACCESS_SECRET=`) are treated as "not set".
const blankToUndefined = (value) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalString = z.preprocess(blankToUndefined, z.string().trim().optional());
const optionalSecret = z.preprocess(
  blankToUndefined,
  z.string().min(32, 'must be at least 32 characters').optional(),
);

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    MONGODB_URI: z.preprocess(
      blankToUndefined,
      z
        .string()
        .regex(/^mongodb(\+srv)?:\/\//, 'must start with mongodb:// or mongodb+srv://')
        .optional(),
    ),
    // How many reverse proxies sit in front of the API (1 on Render alone, 2 with the Vercel /api rewrite).
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
    // WhatsApp Business Cloud API (official Meta API). Optional: without ACCESS_TOKEN and PHONE_NUMBER_ID no message is
    // ever sent; notifications are saved as "skipped" and can be retried once these are set. Never commit real values.
    WHATSAPP_ACCESS_TOKEN: optionalString,
    WHATSAPP_PHONE_NUMBER_ID: optionalString,
    // The business WhatsApp number that receives new-booking alerts. Deliberately has NO default: the owner types it in server/.env.
    WHATSAPP_ADMIN_NUMBER: optionalString,
    WHATSAPP_API_VERSION: z.preprocess(blankToUndefined, z.string().regex(/^v\d+\.\d+$/, 'must look like v21.0').default('v21.0')),
    WHATSAPP_TEMPLATE_ADMIN: z.preprocess(blankToUndefined, z.string().default('vr_new_booking_alert')),
    WHATSAPP_TEMPLATE_CUSTOMER: z.preprocess(blankToUndefined, z.string().default('vr_booking_status_update')),
    WHATSAPP_TEMPLATE_LANGUAGE: z.preprocess(blankToUndefined, z.string().default('en')),
    // Optional contact number printed in messages when Admin > Store settings has no phone number.
    WHATSAPP_BUSINESS_CONTACT: optionalString,
    // One or more comma-separated browser origins allowed by CORS.
    CLIENT_URL: z.preprocess(blankToUndefined, z.string().default('http://localhost:5173')),
    // Use "none" only if the API and the site are on different registrable domains (requires HTTPS).
    COOKIE_SAME_SITE: z.preprocess(blankToUndefined, z.enum(['strict', 'lax', 'none']).default('lax')),
    JWT_ACCESS_SECRET: optionalSecret,
    JWT_REFRESH_SECRET: optionalSecret,
  })
  .superRefine((value, ctx) => {
    const origins = value.CLIENT_URL.split(',').map((o) => o.trim()).filter(Boolean);
    const invalid = origins.find((o) => !URL.canParse(o));
    if (origins.length === 0 || invalid) {
      ctx.addIssue({
        code: 'custom',
        path: ['CLIENT_URL'],
        message: `invalid origin "${invalid ?? ''}" (expected e.g. https://example.com)`,
      });
    }

    if (value.NODE_ENV === 'production') {
      for (const key of ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
        if (!value[key]) {
          ctx.addIssue({ code: 'custom', path: [key], message: 'is required in production' });
        }
      }
      if (value.JWT_ACCESS_SECRET && value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
        ctx.addIssue({
          code: 'custom',
          path: ['JWT_REFRESH_SECRET'],
          message: 'must differ from JWT_ACCESS_SECRET',
        });
      }
    }
  });

export class EnvError extends Error {
  constructor(issues) {
    super(
      `Invalid environment configuration:\n${issues
        .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('\n')}`,
    );
    this.name = 'EnvError';
  }
}

export function loadEnv(source = process.env) {
  const result = schema.safeParse(source);
  if (!result.success) throw new EnvError(result.error.issues);

  const config = result.data;
  return Object.freeze({
    ...config,
    isProduction: config.NODE_ENV === 'production',
    isTest: config.NODE_ENV === 'test',
    CLIENT_ORIGINS: config.CLIENT_URL.split(',').map((o) => o.trim()).filter(Boolean),
  });
}

function loadOrExit() {
  try {
    return loadEnv();
  } catch (error) {
    if (error instanceof EnvError) {
      console.error(`\n${error.message}\n\nSee server/.env.example for the expected variables.\n`);
      process.exit(1);
    }
    throw error;
  }
}

export const env = loadOrExit();
