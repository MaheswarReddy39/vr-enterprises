import crypto from 'node:crypto';
import { Booking } from '../models/Booking.js';
import { Cart } from '../models/Cart.js';
import { InventoryLog } from '../models/InventoryLog.js';
import { Product } from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex, paginationMeta } from '../utils/query.js';
import { notify } from './notification.service.js';
import { toPublicProduct } from './store.service.js';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no look-alike characters

/** e.g. VR-BK-251103-K7M2QX. Uniqueness is guaranteed by the unique index; creation retries on the rare clash. */
function generateBookingId(now = new Date()) {
  const date = now.toISOString().slice(2, 10).replaceAll('-', '');
  const suffix = [...crypto.randomBytes(6)].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `VR-BK-${date}-${suffix}`;
}

const push = (booking, status, note, by) => booking.statusHistory.push({ status, note, by, at: new Date() });
const paise = (rupees) => Math.round(rupees * 100);

const itemView = (i) => ({ productId: String(i.product), name: i.name, sku: i.sku, price: i.price, quantity: i.quantity, lineTotal: i.lineTotal, imageThumbUrl: i.imageThumbUrl });

/** What a customer may see: no internal flags. */
export function toCustomerView(booking) {
  const b = booking.toObject ? booking.toObject() : booking;
  return {
    id: String(b._id),
    bookingId: b.bookingId,
    status: b.status,
    createdAt: b.createdAt,
    items: b.items.map(itemView),
    total: b.total,
    customer: { name: b.customer.name, mobile: b.customer.mobile },
    deliveryAddress: b.deliveryAddress,
    statusHistory: b.statusHistory.map((h) => ({ status: h.status, note: h.note, at: h.at })),
  };
}

export function toAdminView(booking) {
  const b = booking.toObject ? booking.toObject() : booking;
  return { ...toCustomerView(b), customer: b.customer, userId: String(b.user), isRead: b.isRead, readAt: b.readAt, stockDeducted: b.stockDeducted, updatedAt: b.updatedAt };
}

// ---------- customer ----------

/**
 * Creates a PENDING booking. Prices and names always come from the database (never from the browser), and a
 * booking can never ask for more than the stock available right now. No stock is deducted until an admin confirms.
 */
export async function createBooking(user, { name, mobile, address, items, fromCart }) {
  const wanted = new Map();
  for (const { productId, quantity } of items) wanted.set(productId, (wanted.get(productId) ?? 0) + quantity);

  const products = await Product.find({ _id: { $in: [...wanted.keys()] }, status: 'published' });
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const lines = [];
  const problems = [];
  for (const [productId, quantity] of wanted) {
    const p = byId.get(productId);
    if (!p) problems.push({ path: productId, message: 'This product is no longer available.' });
    else if (!(p.price > 0)) problems.push({ path: productId, message: `"${p.name}" is not available for booking yet.` });
    else if (quantity > 10) problems.push({ path: productId, message: `You can book at most 10 of "${p.name}".` });
    else if (quantity > p.stock) problems.push({ path: productId, message: p.stock > 0 ? `Only ${p.stock} of "${p.name}" ${p.stock === 1 ? 'is' : 'are'} available.` : `"${p.name}" is out of stock.` });
    else lines.push({ product: p._id, name: p.name, sku: p.sku, price: p.price, quantity, lineTotal: paise(p.price) * quantity / 100, imageThumbUrl: toPublicProduct(p).primaryImage?.thumbUrl });
  }
  if (problems.length) throw new ApiError(409, problems[0].message, problems);

  // Duplicate protection: a double click, a retry or a second tab sends the same request again. The same customer,
  // the same items and the same 2-minute window share one dedupeKey, which is UNIQUE in the database, so only one
  // booking can ever be created and the others get that booking back (atomic, unlike check-then-insert).
  const signature = lines.map((l) => `${l.product}:${l.quantity}`).sort().join('|');
  const dedupeKey = `${user._id}|${signature}|${Math.floor(Date.now() / (2 * 60 * 1000))}`;
  const existing = async () => {
    const found = await Booking.findOne({ dedupeKey, status: 'pending' });
    if (found && fromCart) await Cart.updateOne({ user: user._id }, { $pull: { items: { product: { $in: lines.map((l) => l.product) } } } });
    return found;
  };
  const already = await existing();
  if (already) return already;

  const total = lines.reduce((sum, l) => sum + paise(l.price) * l.quantity, 0) / 100;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const booking = await Booking.create({
        bookingId: generateBookingId(),
        user: user._id,
        customer: { name, mobile, email: user.email },
        items: lines,
        total,
        deliveryAddress: address,
        dedupeKey,
        statusHistory: [{ status: 'pending', note: 'Booking submitted', at: new Date() }],
      });
      if (fromCart) await Cart.updateOne({ user: user._id }, { $pull: { items: { product: { $in: lines.map((l) => l.product) } } } });
      notify('admin_new_booking', booking); // background; a WhatsApp problem can never affect the booking
      return booking;
    } catch (error) {
      if (error?.code === 11000 && error.keyPattern?.dedupeKey) {
        const winner = await existing();
        if (winner) return winner;
      }
      if (error?.code !== 11000 || attempt === 2) throw error;
    }
  }
  throw new ApiError(500, 'Could not create the booking. Please try again.');
}

export async function listMine(userId, { page, limit }) {
  const [items, total] = await Promise.all([
    Booking.find({ user: userId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Booking.countDocuments({ user: userId }),
  ]);
  return { items: items.map(toCustomerView), pagination: paginationMeta(total, page, limit) };
}

export async function getMine(userId, id) {
  const booking = await Booking.findOne({ _id: id, user: userId });
  if (!booking) throw new ApiError(404, 'Booking not found.');
  return toCustomerView(booking);
}

// ---------- admin ----------

export async function listAdmin({ page, limit, q, status, unread, customer }) {
  const filter = {};
  if (customer) filter.user = customer;
  if (status) filter.status = status;
  if (unread) filter.isRead = false;
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    filter.$or = [{ bookingId: rx }, { 'customer.email': rx }, { 'customer.name': rx }, { 'customer.mobile': rx }];
  }
  const [items, total, unreadCount] = await Promise.all([
    Booking.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Booking.countDocuments(filter),
    Booking.countDocuments({ isRead: false }),
  ]);
  return { items: items.map(toAdminView), pagination: paginationMeta(total, page, limit), unreadCount };
}

export const unreadCount = () => Booking.countDocuments({ isRead: false });

async function findBooking(id) {
  const booking = await Booking.findById(id);
  if (!booking) throw new ApiError(404, 'Booking not found.');
  return booking;
}

/** Opening a booking marks it read. */
export async function getAdmin(id) {
  const booking = await findBooking(id);
  if (!booking.isRead) {
    booking.isRead = true;
    booking.readAt = new Date();
    await booking.save();
  }
  return booking;
}

export async function setRead(id, isRead) {
  const booking = await findBooking(id);
  booking.isRead = isRead;
  booking.readAt = isRead ? new Date() : undefined;
  await booking.save();
  return booking;
}

export async function markAllRead() {
  const result = await Booking.updateMany({ isRead: false }, { $set: { isRead: true, readAt: new Date() } });
  return result.modifiedCount;
}

// Where each new status may come from. Every change is ONE atomic update that also checks the current status,
// so two admins (or a double click) can never apply the same step twice.
const FROM = { confirmed: 'pending', rejected: 'pending', processing: 'confirmed', completed: 'processing' };

async function rejectStale(id, status) {
  const current = await Booking.findById(id).select('status');
  if (!current) throw new ApiError(404, 'Booking not found.');
  throw new ApiError(409, `A booking that is "${current.status}" cannot move to "${status}".`);
}

const statusUpdate = (admin, status, note) => ({
  $set: { status, isRead: true },
  $unset: { dedupeKey: 1 },
  $push: { statusHistory: { status, note, by: admin._id, at: new Date() } },
});

/**
 * Undoes a confirmation that did not finish: every product that carries this booking's marker gets its stock back
 * (marker removed in the same atomic update, so running this twice is harmless), the history entries are removed
 * and the claim is released. Used both when a step fails and by recoverBookings() after a crash or restart.
 */
async function rollbackClaim(booking) {
  for (const item of booking.items) {
    await Product.updateOne({ _id: item.product, appliedBookings: booking.bookingId }, { $inc: { stock: item.quantity }, $pull: { appliedBookings: booking.bookingId } });
  }
  await InventoryLog.deleteMany({ type: 'sale', note: `Booking ${booking.bookingId}` });
  await Booking.updateOne({ _id: booking._id, status: 'pending' }, { $set: { stockDeducted: false }, $unset: { claimedAt: 1 } });
}

/** Removes the markers once a confirmation is complete (they are only needed while it is in progress). */
const clearMarkers = (booking) => Product.updateMany({ _id: { $in: booking.items.map((i) => i.product) } }, { $pull: { appliedBookings: booking.bookingId } }).catch((e) => console.error('Marker cleanup failed:', e.message));

/**
 * Confirming deducts stock. Without transactions this is done as safe sequential steps:
 *  1. claim the booking atomically (pending + stockDeducted false -> true): only ONE request can win, so stock is never deducted twice;
 *  2. deduct each item with ONE guarded update that also records the booking ID on the product (cannot go below zero,
 *     cannot apply the same booking twice, and leaves a durable trail for crash recovery);
 *  3. write the inventory history, then the status change;
 *  if any step fails the claim is rolled back and the booking stays Pending. If the server dies mid-way,
 *  recoverBookings() performs the same rollback on the next start.
 */
async function confirm(admin, id, note) {
  const claimed = await Booking.findOneAndUpdate({ _id: id, status: 'pending', stockDeducted: false }, { $set: { stockDeducted: true, claimedAt: new Date() } }, { new: true });
  if (!claimed) return rejectStale(id, 'confirmed');

  try {
    const logs = [];
    for (const item of claimed.items) {
      const before = await Product.findOneAndUpdate(
        { _id: item.product, stock: { $gte: item.quantity }, appliedBookings: { $ne: claimed.bookingId } },
        { $inc: { stock: -item.quantity }, $addToSet: { appliedBookings: claimed.bookingId } },
        { new: false },
      );
      if (!before) throw new ApiError(409, `Not enough stock for ${item.name} (${item.sku}). Restock it or reject the booking.`);
      logs.push({ product: before._id, productName: before.name, sku: before.sku, type: 'sale', delta: -item.quantity, balanceAfter: before.stock - item.quantity, reason: 'sale', note: `Booking ${claimed.bookingId}`, performedBy: admin._id });
    }
    await InventoryLog.create(logs, { ordered: true });
    const done = await Booking.findOneAndUpdate({ _id: id, status: 'pending', stockDeducted: true }, { ...statusUpdate(admin, 'confirmed', note), $unset: { claimedAt: 1, dedupeKey: 1 } }, { new: true });
    if (!done) throw new ApiError(409, 'This booking changed while it was being confirmed. Please reload.');
    await clearMarkers(claimed);
    notify('customer_status', done, 'confirmed');
    return done;
  } catch (error) {
    await rollbackClaim(claimed).catch((e) => console.error('Rollback failed for', claimed.bookingId, e.message));
    throw error;
  }
}

/**
 * Crash recovery. Finds confirmations that were claimed but never finished (the server stopped part-way) and rolls
 * them back so stock is correct and the booking can simply be confirmed again. Also removes leftover markers.
 * Runs at start-up and then every few minutes; `olderThanMs` keeps it away from confirmations still in progress.
 */
export async function recoverBookings({ olderThanMs = 2 * 60 * 1000 } = {}) {
  const cutoff = new Date(Date.now() - olderThanMs);
  const stuck = await Booking.find({ status: 'pending', stockDeducted: true, claimedAt: { $lt: cutoff } });
  for (const booking of stuck) {
    await rollbackClaim(booking);
    console.warn(`Recovered interrupted confirmation of ${booking.bookingId}: stock restored, booking is Pending again.`);
  }
  // Markers of finished bookings (cleanup that was interrupted) are harmless but removed here.
  const marked = await Product.find({ 'appliedBookings.0': { $exists: true } }).select('appliedBookings');
  for (const product of marked) {
    for (const bookingId of product.appliedBookings) {
      const b = await Booking.findOne({ bookingId }).select('status stockDeducted claimedAt');
      if (!b || (b.status !== 'pending' && b.stockDeducted)) await Product.updateOne({ _id: product._id }, { $pull: { appliedBookings: bookingId } });
    }
  }
  return stuck.length;
}

export async function updateStatus(admin, id, { status, note }) {
  if (status === 'confirmed') return confirm(admin, id, note);
  // Rejecting also requires that no stock is held, so it can never race with a confirmation in progress.
  const filter = { _id: id, status: FROM[status], ...(status === 'rejected' && { stockDeducted: false }) };
  const updated = (await Booking.findOneAndUpdate(filter, statusUpdate(admin, status, note), { new: true })) ?? (await rejectStale(id, status));
  notify('customer_status', updated, status);
  return updated;
}
