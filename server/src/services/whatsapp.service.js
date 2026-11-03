import { env } from '../config/env.js';

/**
 * Low-level client for the official Meta WhatsApp Business Cloud API (graph.facebook.com). Nothing else is used:
 * no unofficial libraries, no WhatsApp Web, no browser automation. The access token only ever lives in server
 * environment variables and is never logged or returned to the browser.
 */

let testOverride = null;
/** Tests inject a fake configuration here (ignored outside NODE_ENV=test), so no real message can ever be sent by a test. */
export const setConfigForTests = (config) => {
  if (env.isTest) testOverride = config;
};

export function getConfig() {
  const c = testOverride ?? {
    accessToken: env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    adminNumber: env.WHATSAPP_ADMIN_NUMBER,
    apiVersion: env.WHATSAPP_API_VERSION,
    adminTemplate: env.WHATSAPP_TEMPLATE_ADMIN,
    customerTemplate: env.WHATSAPP_TEMPLATE_CUSTOMER,
    language: env.WHATSAPP_TEMPLATE_LANGUAGE,
    businessContact: env.WHATSAPP_BUSINESS_CONTACT,
  };
  return { ...c, configured: Boolean(c.accessToken && c.phoneNumberId) };
}

/**
 * Indian mobile numbers -> "91XXXXXXXXXX" (what the API wants, without "+"). Accepts "9876543210", "+91 98765 43210",
 * "919876543210", "09876543210" and "0091 98765 43210". Returns null for anything that is not a valid Indian mobile
 * number (10 digits starting 6-9).
 */
export function normalizeIndianMobile(input) {
  let digits = String(input ?? '').replace(/\D/g, '');
  if (digits.startsWith('0091')) digits = digits.slice(4);
  else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? `91${digits}` : null;
}

/** "919876543210" -> "+91 ••••• 43210" for screens. */
export const maskNumber = (to) => (to && to.length === 12 ? `+91 ••••• ${to.slice(7)}` : '');

/** Template variables may not contain line breaks or runs of spaces, and are length-limited by Meta. */
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) || '-';

/** Removes the access token (and anything that looks like one) from text that is stored or logged. */
export function redact(text, token = getConfig().accessToken) {
  let out = String(text ?? '');
  if (token) out = out.split(token).join('[redacted]');
  return out.replace(/EA[A-Za-z0-9]{20,}/g, '[redacted]').replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').slice(0, 300);
}

export class WhatsAppError extends Error {
  constructor(message, { code, retryable } = {}) {
    super(message);
    this.name = 'WhatsAppError';
    this.code = code;
    this.retryable = retryable;
  }
}

/** Sends one approved TEMPLATE message. Returns the WhatsApp message id. Throws WhatsAppError with a safe message. */
export async function sendTemplate({ to, template, params }) {
  const cfg = getConfig();
  if (!cfg.configured) throw new WhatsAppError('WhatsApp is not configured on the server.');

  let response;
  try {
    response = await fetch(`https://graph.facebook.com/${cfg.apiVersion}/${cfg.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: { name: template, language: { code: cfg.language }, components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text: clean(text) })) }] },
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new WhatsAppError(redact(error?.name === 'TimeoutError' ? 'WhatsApp did not answer in time.' : `Could not reach WhatsApp: ${error?.message ?? 'network error'}`), { retryable: true });
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    /* a non-JSON answer is reported below */
  }
  if (!response.ok) {
    const e = body?.error ?? {};
    throw new WhatsAppError(redact(`${e.message ?? `WhatsApp returned HTTP ${response.status}`}${e.error_data?.details ? ` (${e.error_data.details})` : ''}`), { code: e.code ?? response.status, retryable: response.status >= 500 || response.status === 429 });
  }
  const messageId = body?.messages?.[0]?.id;
  if (!messageId) throw new WhatsAppError('WhatsApp accepted the request but returned no message id.');
  return messageId;
}
