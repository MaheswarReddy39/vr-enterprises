import { Notification } from '../models/Notification.js';
import { ApiError } from '../utils/ApiError.js';
import { paginationMeta } from '../utils/query.js';
import { getSettings } from './settings.service.js';
import { getConfig, maskNumber, normalizeIndianMobile, redact, sendTemplate } from './whatsapp.service.js';

const STATUS_LABEL = { confirmed: 'Confirmed', rejected: 'Rejected', processing: 'Processing', completed: 'Completed' };
const STALE_LOCK_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------------------------------------------
// Message templates. WhatsApp only allows a business to START a conversation with a pre-approved TEMPLATE, so each
// message below is the list of {{variables}} for a template you create and get approved in Meta Business Manager.
// The exact template text to submit is in README.md ("WhatsApp notifications"); the order of variables must match.
// ---------------------------------------------------------------------------------------------------------------

const productSummary = (booking) => booking.items.map((i) => `${i.name} x ${i.quantity}`).join(', ');

/** Alert to the business: a customer has just submitted a booking. */
const adminAlert = ({ booking, business, contact }) => ({
  to: getConfig().adminNumber ? normalizeIndianMobile(getConfig().adminNumber) : null,
  template: getConfig().adminTemplate,
  // {{1}} business, {{2}} booking ID, {{3}} customer name, {{4}} customer mobile, {{5}} product and quantity, {{6}} business contact
  params: [business, booking.bookingId, booking.customer.name, booking.customer.mobile, productSummary(booking), contact],
});

/** Status update to the customer: the booking was confirmed, rejected, set to processing or completed. */
const customerUpdate = ({ booking, status, business, contact }) => ({
  to: normalizeIndianMobile(booking.customer.mobile),
  template: getConfig().customerTemplate,
  // {{1}} business, {{2}} customer name, {{3}} booking ID, {{4}} product and quantity, {{5}} status, {{6}} business contact
  params: [business, booking.customer.name, booking.bookingId, productSummary(booking), STATUS_LABEL[status] ?? status, contact],
});

// ---------------------------------------------------------------------------------------------------------------

const inflight = new Set();
/** Lets tests (and a graceful shutdown) wait for notifications that are still being sent. */
export const settled = () => Promise.allSettled([...inflight]);

/**
 * Queues a WhatsApp message and sends it in the background. NEVER throws and is not awaited by callers, so a
 * WhatsApp problem can never fail, slow down or undo a booking.
 */
export function notify(kind, booking, status = '') {
  const task = enqueue(kind, booking, status).catch((error) => console.error('Notification failed to queue:', redact(error?.message)));
  inflight.add(task);
  task.finally(() => inflight.delete(task));
  return task;
}

async function enqueue(kind, booking, status) {
  const settings = await getSettings();
  const cfg = getConfig();
  const ctx = { booking, status, business: settings.business.name || 'VR Water Solutions', contact: settings.business.phone || cfg.businessContact || '-' };
  const message = kind === 'admin_new_booking' ? adminAlert(ctx) : customerUpdate(ctx);
  const dedupeKey = `${booking.bookingId}:${kind}${kind === 'customer_status' ? `:${status}` : ''}`;

  let created;
  try {
    created = await Notification.findOneAndUpdate(
      { dedupeKey },
      { $setOnInsert: { booking: booking._id, bookingId: booking.bookingId, kind, status, to: message.to ?? '', template: message.template, params: message.params, dedupeKey } },
      { upsert: true, new: true, includeResultMetadata: true },
    );
  } catch (error) {
    if (error?.code === 11000) return null; // another request just created it
    throw error;
  }
  // The same booking + kind + status already has a message: do nothing (this is the duplicate guard).
  if (created.lastErrorObject?.updatedExisting) return null;
  return attempt(created.value._id);
}

/** Claims the message (so two requests cannot send it twice) and sends it. */
async function attempt(id) {
  const claimed = await Notification.findOneAndUpdate(
    { _id: id, $or: [{ state: { $in: ['pending', 'failed', 'skipped'] } }, { state: 'sending', lockedAt: { $lt: new Date(Date.now() - STALE_LOCK_MS) } }] },
    { $set: { state: 'sending', lockedAt: new Date() }, $inc: { attempts: 1 } },
    { new: true },
  );
  if (!claimed) return null;

  // The business number is read at SEND time, so an alert queued before the number was added still works on retry.
  const to = claimed.kind === 'admin_new_booking' ? normalizeIndianMobile(getConfig().adminNumber) ?? '' : claimed.to;
  const finish = (set) => Notification.findByIdAndUpdate(id, { $set: { lockedAt: null, to, ...set } }, { new: true });
  if (!getConfig().configured) return finish({ state: 'skipped', lastError: 'WhatsApp is not configured on the server yet. Retry after adding the credentials.' });
  if (!to) return finish({ state: 'failed', lastError: claimed.kind === 'admin_new_booking' ? 'The business WhatsApp number (WHATSAPP_ADMIN_NUMBER) is missing or not a valid Indian mobile number.' : 'The customer mobile number is not a valid Indian mobile number.' });
  if (!claimed.template) return finish({ state: 'failed', lastError: 'No WhatsApp template name is configured for this message.' });

  try {
    const messageId = await sendTemplate({ to, template: claimed.template, params: claimed.params });
    return await finish({ state: 'sent', providerMessageId: messageId, sentAt: new Date(), lastError: '' });
  } catch (error) {
    const text = redact(error?.message ?? 'Unknown error');
    console.error(`WhatsApp notification ${claimed.dedupeKey} failed: ${text}`);
    return finish({ state: 'failed', lastError: error?.code ? `[${error.code}] ${text}` : text });
  }
}

// ---------- admin ----------

export const toView = (n) => ({
  id: String(n._id),
  bookingRef: String(n.booking),
  bookingId: n.bookingId,
  kind: n.kind,
  status: n.status,
  to: maskNumber(n.to),
  template: n.template,
  state: n.state,
  attempts: n.attempts,
  lastError: n.lastError,
  sentAt: n.sentAt,
  createdAt: n.createdAt,
});

export async function listNotifications({ page, limit, state, booking }) {
  const filter = {};
  if (state) filter.state = state;
  if (booking) filter.booking = booking;
  const [items, total, failed] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ state: 'failed' }),
  ]);
  return { items: items.map(toView), pagination: paginationMeta(total, page, limit), failedCount: failed, whatsapp: { configured: getConfig().configured } };
}

/** Retries a failed or skipped message. A message that was already sent can never be sent again. */
export async function retryNotification(id) {
  const n = await Notification.findById(id);
  if (!n) throw new ApiError(404, 'Notification not found.');
  if (n.state === 'sent') throw new ApiError(409, 'This message was already sent.');
  if (n.state === 'sending' && n.lockedAt > new Date(Date.now() - STALE_LOCK_MS)) throw new ApiError(409, 'This message is being sent right now.');
  const result = await attempt(id);
  if (!result) throw new ApiError(409, 'This message cannot be retried right now.');
  return toView(result);
}

export const failedCount = () => Notification.countDocuments({ state: 'failed' });
