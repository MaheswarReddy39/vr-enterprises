import assert from 'node:assert/strict';
import { after, before, describe, it, mock } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import { Booking } from '../src/models/Booking.js';
import { Cart } from '../src/models/Cart.js';
import { Category } from '../src/models/Category.js';
import { InventoryLog } from '../src/models/InventoryLog.js';
import { Product } from '../src/models/Product.js';
import { recoverBookings } from '../src/services/booking.service.js';
import { PASSWORD, adminSession, createUser, login, setupDb, skipReason, teardownDb } from './helpers/db.js';

describe('bookings', { skip: skipReason }, () => {
  let app;
  let admin;
  let staff;
  let category;
  const oid = () => new mongoose.Types.ObjectId();
  const api = (method, path, token) => {
    const r = request(app)[method](`/api/v1${path}`);
    return token ? r.set('Authorization', `Bearer ${token}`) : r;
  };
  const address = { line1: '12 Test Road', city: 'Town', state: 'State', postalCode: '560001' };
  let n = 0;
  const product = (stock = 5, price = 1000, extra = {}) => {
    n += 1;
    return Product.create({ name: `Purifier ${n}`, slug: `purifier-${n}-${Math.random().toString(36).slice(2, 6)}`, sku: `BK-${n}${Math.random().toString(36).slice(2, 6).toUpperCase()}`, category: category._id, price, stock, status: 'published', images: [{ fileId: oid(), thumbFileId: oid(), isPrimary: true }], ...extra });
  };
  const customer = async () => {
    const email = `c${Math.random().toString(36).slice(2, 8)}@example.com`;
    const res = await api('post', '/auth/register').send({ name: 'Cara Customer', email, password: PASSWORD });
    return { token: res.body.accessToken, id: res.body.user._id, email };
  };
  const body = (items, extra = {}) => ({ name: 'Cara Customer', mobile: '98765 43210', address, items, ...extra });
  const book = (c, items, extra) => api('post', '/account/bookings', c.token).send(body(items, extra));

  before(async () => {
    app = await setupDb();
    admin = await adminSession(app);
    staff = await adminSession(app, 'staff');
    category = await Category.create({ name: 'Bookings', slug: 'bookings' });
  });
  after(teardownDb);

  describe('creating a booking', () => {
    it('requires a signed-in customer', async () => {
      const p = await product();
      assert.equal((await api('post', '/account/bookings').send(body([{ productId: String(p._id), quantity: 1 }]))).status, 401);
    });

    it('saves a pending booking with a unique id, prices from the database, and takes no payment', async () => {
      const p = await product(5, 1999.5);
      const c = await customer();
      const res = await book(c, [{ productId: String(p._id), quantity: 2 }]);
      assert.equal(res.status, 201);
      const b = res.body.booking;
      assert.match(b.bookingId, /^VR-BK-\d{6}-[A-Z0-9]{6}$/);
      assert.equal(b.status, 'pending');
      assert.equal(b.total, 3999);
      assert.deepEqual([b.items[0].price, b.items[0].quantity, b.items[0].name], [1999.5, 2, p.name]);
      assert.deepEqual([b.customer.name, b.customer.mobile], ['Cara Customer', '98765 43210']);
      assert.equal(b.deliveryAddress.line1, '12 Test Road');
      assert.ok(!JSON.stringify(b).match(/razorpay|payment|isRead|stockDeducted/i), 'no payment or internal fields');
      const second = await book(c, [{ productId: String(p._id), quantity: 1 }]);
      assert.notEqual(second.body.booking.bookingId, b.bookingId);
      const stored = await Booking.findOne({ bookingId: b.bookingId });
      assert.equal(stored.isRead, false);
      assert.equal(String(stored.user), c.id);
    });

    it('ignores any price sent by the browser (strict body)', async () => {
      const p = await product();
      const c = await customer();
      const res = await book(c, [{ productId: String(p._id), quantity: 1, price: 1 }]);
      assert.equal(res.status, 400);
    });

    it('does NOT deduct stock when a booking is submitted', async () => {
      const p = await product(5);
      const c = await customer();
      await book(c, [{ productId: String(p._id), quantity: 3 }]);
      assert.equal((await Product.findById(p._id)).stock, 5);
      assert.equal(await InventoryLog.countDocuments({ product: p._id }), 0);
    });

    it('never accepts more than the available stock, and merges duplicate lines before checking', async () => {
      const p = await product(3);
      const c = await customer();
      const over = await book(c, [{ productId: String(p._id), quantity: 4 }]);
      assert.equal(over.status, 409);
      assert.match(over.body.message, /Only 3/);
      const split = await book(c, [{ productId: String(p._id), quantity: 2 }, { productId: String(p._id), quantity: 2 }]);
      assert.equal(split.status, 409, 'two lines of 2 are 4 in total');
      const out = await product(0);
      assert.equal((await book(c, [{ productId: String(out._id), quantity: 1 }])).status, 409);
      assert.equal(await Booking.countDocuments({ user: c.id }), 0);
    });

    it('refuses products whose price has not been entered, even when they are in stock', async () => {
      const unpriced = await product(10, 0);
      const c = await customer();
      const res = await book(c, [{ productId: String(unpriced._id), quantity: 1 }]);
      assert.equal(res.status, 409);
      assert.match(res.body.message, /not available for booking yet/);
      assert.equal(await Booking.countDocuments({ user: c.id }), 0);
      // and the public catalogue and cart treat it as unavailable
      const pub = (await api('get', `/store/products/${unpriced.slug}`)).body.product;
      assert.deepEqual([pub.bookable, pub.maxQuantity], [false, 0]);
      const quoted = (await api('post', '/store/cart/quote').send({ items: [{ productId: String(unpriced._id), quantity: 1 }] })).body.cart;
      assert.deepEqual([quoted.lines[0].available, quoted.itemCount], [false, 0]);
    });

    it('rejects unpublished or unknown products and invalid details', async () => {
      const draft = await product(5, 100, { status: 'draft' });
      const c = await customer();
      assert.equal((await book(c, [{ productId: String(draft._id), quantity: 1 }])).status, 409);
      assert.equal((await book(c, [{ productId: String(oid()), quantity: 1 }])).status, 409);
      const p = await product();
      const item = [{ productId: String(p._id), quantity: 1 }];
      for (const extra of [{ name: 'x' }, { mobile: 'abc' }, { address: { ...address, line1: '' } }, { address: { ...address, postalCode: '!!' } }, { items: [] }, { status: 'confirmed' }]) {
        assert.equal((await book(c, item, extra)).status, 400, JSON.stringify(extra));
      }
      assert.equal((await book(c, [{ productId: String(p._id), quantity: 0 }])).status, 400);
      assert.equal((await book(c, [{ productId: String(p._id), quantity: 11 }])).status, 400);
    });

    it('does not create a duplicate when the same booking is submitted twice (double click / retry)', async () => {
      const p = await product(10);
      const c = await customer();
      const items = [{ productId: String(p._id), quantity: 2 }];
      const all = await Promise.all(Array.from({ length: 8 }, () => book(c, items)));
      const [a] = all;
      assert.equal(await Booking.countDocuments({ user: c.id }), 1);
      assert.equal(new Set(all.map((r) => r.body.booking.bookingId)).size, 1);
      const other = await book(c, [{ productId: String(p._id), quantity: 3 }]);
      assert.notEqual(other.body.booking.bookingId, a.body.booking.bookingId, 'a different request is a new booking');
      assert.equal(await Booking.countDocuments({ user: c.id }), 2);
    });

    it('allows booking the same items again once the first booking was rejected', async () => {
      const p = await product(10);
      const c = await customer();
      const items = [{ productId: String(p._id), quantity: 1 }];
      const first = (await book(c, items)).body.booking;
      await api('patch', `/admin/bookings/${first.id}/status`, admin.token).send({ status: 'rejected' });
      const again = (await book(c, items)).body.booking;
      assert.notEqual(again.bookingId, first.bookingId);
      assert.equal(again.status, 'pending');
    });

    it('clears booked lines from the saved cart only when booking from the cart', async () => {
      const p = await product();
      const other = await product();
      const c = await customer();
      await api('put', `/account/cart/items/${p._id}`, c.token).send({ quantity: 1 });
      await api('put', `/account/cart/items/${other._id}`, c.token).send({ quantity: 1 });
      await book(c, [{ productId: String(p._id), quantity: 1 }]);
      assert.equal((await Cart.findOne({ user: c.id })).items.length, 2, 'a direct Book Now leaves the cart alone');
      await book(c, [{ productId: String(p._id), quantity: 1 }], { fromCart: true });
      assert.deepEqual((await Cart.findOne({ user: c.id })).items.map((i) => String(i.product)), [String(other._id)]);
    });
  });

  describe('My Bookings', () => {
    it('lists only the signed-in customer\'s bookings and hides other people\'s', async () => {
      const p = await product(10);
      const a = await customer();
      const b = await customer();
      const mine = (await book(a, [{ productId: String(p._id), quantity: 1 }])).body.booking;
      await book(b, [{ productId: String(p._id), quantity: 1 }]);
      const list = (await api('get', '/account/bookings', a.token)).body;
      assert.equal(list.items.length, 1);
      assert.equal(list.items[0].bookingId, mine.bookingId);
      assert.equal((await api('get', `/account/bookings/${mine.id}`, a.token)).status, 200);
      assert.equal((await api('get', `/account/bookings/${mine.id}`, b.token)).status, 404, 'not found for another customer');
      assert.equal((await api('get', '/account/bookings')).status, 401);
    });

    it('shows the customer the status after the admin acts', async () => {
      const p = await product(10);
      const c = await customer();
      const b = (await book(c, [{ productId: String(p._id), quantity: 1 }])).body.booking;
      await api('patch', `/admin/bookings/${b.id}/status`, admin.token).send({ status: 'rejected', note: 'Out of delivery area' });
      const view = (await api('get', `/account/bookings/${b.id}`, c.token)).body.booking;
      assert.equal(view.status, 'rejected');
      assert.equal(view.statusHistory.at(-1).note, 'Out of delivery area');
    });
  });

  describe('admin access', () => {
    it('is closed to anonymous users and customers', async () => {
      const c = await customer();
      const p = await product();
      const b = (await book(c, [{ productId: String(p._id), quantity: 1 }])).body.booking;
      const calls = [['get', '/admin/bookings'], ['get', '/admin/bookings/unread-count'], ['post', '/admin/bookings/read-all'], ['get', `/admin/bookings/${b.id}`], ['patch', `/admin/bookings/${b.id}/read`], ['patch', `/admin/bookings/${b.id}/status`]];
      for (const [method, path] of calls) {
        assert.equal((await api(method, path)).status, 401, `${method} ${path}`);
        assert.equal((await api(method, path, c.token)).status, 403, `${method} ${path}`);
      }
      assert.equal((await Booking.findById(b.id)).status, 'pending');
    });

    it('lets staff and admins list bookings with customer details, search and filters', async () => {
      const c = await customer();
      const p = await product(10);
      const b = (await book(c, [{ productId: String(p._id), quantity: 2 }])).body.booking;
      for (const token of [admin.token, staff.token]) {
        const res = await api('get', `/admin/bookings?q=${b.bookingId}`, token);
        assert.equal(res.status, 200);
        const row = res.body.items[0];
        assert.deepEqual([row.customer.name, row.customer.mobile, row.customer.email, row.items[0].quantity, row.deliveryAddress.city], ['Cara Customer', '98765 43210', c.email, 2, 'Town']);
        assert.ok(row.createdAt);
      }
      assert.equal((await api('get', '/admin/bookings?q=98765', admin.token)).body.items.length >= 1, true);
      assert.equal((await api('get', '/admin/bookings?status=bogus', admin.token)).status, 400);
      assert.equal((await api('get', `/admin/bookings?customer=${c.id}&status=pending`, admin.token)).body.items.length, 1);
    });
  });

  describe('new-booking alerts', () => {
    it('counts unread bookings, marks one read on open or on request, and all at once', async () => {
      await Booking.deleteMany({});
      const p = await product(50);
      const c = await customer();
      const ids = [];
      for (let i = 1; i <= 3; i += 1) ids.push((await book(c, [{ productId: String(p._id), quantity: i }])).body.booking.id);
      assert.equal((await api('get', '/admin/bookings/unread-count', admin.token)).body.unreadCount, 3);
      assert.equal((await api('get', `/admin/bookings/${ids[0]}`, staff.token)).body.booking.isRead, true, 'opening marks it read');
      assert.equal((await api('get', '/admin/bookings/unread-count', admin.token)).body.unreadCount, 2);
      const read = await api('patch', `/admin/bookings/${ids[1]}/read`, admin.token).send({ isRead: true });
      assert.equal(read.body.booking.isRead, true);
      assert.equal((await api('patch', `/admin/bookings/${ids[1]}/read`, admin.token).send({ isRead: false })).body.booking.isRead, false);
      assert.equal((await api('get', '/admin/bookings?unread=true', admin.token)).body.items.length, 2);
      assert.equal((await api('post', '/admin/bookings/read-all', admin.token)).body.updated, 2);
      assert.equal((await api('get', '/admin/bookings/unread-count', admin.token)).body.unreadCount, 0);
    });

    it('marks a booking read when the admin acts on it', async () => {
      const p = await product();
      const c = await customer();
      const b = (await book(c, [{ productId: String(p._id), quantity: 1 }])).body.booking;
      await api('patch', `/admin/bookings/${b.id}/status`, admin.token).send({ status: 'rejected' });
      assert.equal((await Booking.findById(b.id)).isRead, true);
    });
  });

  describe('status changes and stock', () => {
    const status = (token, id, s, note) => api('patch', `/admin/bookings/${id}/status`, token).send({ status: s, note });

    it('confirming deducts stock once, with inventory history; later steps never deduct again', async () => {
      const p = await product(10);
      const c = await customer();
      const b = (await book(c, [{ productId: String(p._id), quantity: 4 }])).body.booking;
      const res = await status(admin.token, b.id, 'confirmed');
      assert.equal(res.status, 200);
      assert.equal(res.body.booking.status, 'confirmed');
      assert.equal((await Product.findById(p._id)).stock, 6);
      const logs = await InventoryLog.find({ product: p._id });
      assert.equal(logs.length, 1);
      assert.deepEqual([logs[0].delta, logs[0].balanceAfter, logs[0].type], [-4, 6, 'sale']);
      assert.match(logs[0].note, new RegExp(b.bookingId));

      assert.equal((await status(admin.token, b.id, 'confirmed')).status, 409, 'confirming twice is refused');
      assert.equal((await status(admin.token, b.id, 'processing')).status, 200);
      assert.equal((await status(staff.token, b.id, 'completed')).status, 200);
      assert.equal((await Product.findById(p._id)).stock, 6);
      assert.equal(await InventoryLog.countDocuments({ product: p._id }), 1);
    });

    it('concurrent confirmations deduct exactly once', async () => {
      const p = await product(10);
      const c = await customer();
      const b = (await book(c, [{ productId: String(p._id), quantity: 3 }])).body.booking;
      const results = await Promise.all([1, 2, 3, 4].map(() => status(admin.token, b.id, 'confirmed')));
      assert.equal(results.filter((r) => r.status === 200).length, 1);
      assert.equal((await Product.findById(p._id)).stock, 7);
      assert.equal(await InventoryLog.countDocuments({ product: p._id }), 1);
    });

    it('refuses to confirm when stock fell short, changes nothing, and never goes negative', async () => {
      const p = await product(5);
      const q = await product(5);
      const c = await customer();
      const b = (await book(c, [{ productId: String(p._id), quantity: 2 }, { productId: String(q._id), quantity: 5 }])).body.booking;
      await Product.updateOne({ _id: q._id }, { $set: { stock: 2 } }); // sold elsewhere meanwhile
      const res = await status(admin.token, b.id, 'confirmed');
      assert.equal(res.status, 409);
      assert.match(res.body.message, /Not enough stock/);
      assert.equal((await Product.findById(p._id)).stock, 5, 'the first line was rolled back with the transaction');
      assert.equal((await Product.findById(q._id)).stock, 2);
      const stored = await Booking.findById(b.id);
      assert.deepEqual([stored.status, stored.stockDeducted], ['pending', false]);
      assert.equal(await InventoryLog.countDocuments({ product: { $in: [p._id, q._id] } }), 0);
    });

    it('rejecting never touches stock and cannot be undone; steps cannot be skipped', async () => {
      const p = await product(5);
      const c = await customer();
      const b = (await book(c, [{ productId: String(p._id), quantity: 2 }])).body.booking;
      assert.equal((await status(admin.token, b.id, 'processing')).status, 409, 'must confirm first');
      assert.equal((await status(admin.token, b.id, 'completed')).status, 409);
      assert.equal((await status(admin.token, b.id, 'rejected', 'Cannot deliver')).status, 200);
      assert.equal((await Product.findById(p._id)).stock, 5);
      assert.equal((await status(admin.token, b.id, 'confirmed')).status, 409);
      assert.equal((await Product.findById(p._id)).stock, 5);
    });

    it('puts the stock back and keeps the booking Pending when writing the history fails', async () => {
      const p = await product(5);
      const q = await product(5);
      const c = await customer();
      const b = (await book(c, [{ productId: String(p._id), quantity: 2 }, { productId: String(q._id), quantity: 3 }])).body.booking;
      const failing = mock.method(InventoryLog, 'create', async () => { throw new Error('simulated log write failure'); });
      try {
        assert.equal((await status(admin.token, b.id, 'confirmed')).status, 500);
      } finally {
        failing.mock.restore();
      }
      assert.equal((await Product.findById(p._id)).stock, 5);
      assert.equal((await Product.findById(q._id)).stock, 5);
      const stored = await Booking.findById(b.id);
      assert.deepEqual([stored.status, stored.stockDeducted], ['pending', false]);
      assert.equal((await status(admin.token, b.id, 'confirmed')).status, 200, 'it can be confirmed normally afterwards');
      assert.equal((await Product.findById(p._id)).stock, 3);
    });

    it('a confirm and a reject sent together end in exactly one consistent state', async () => {
      const p = await product(5);
      const c = await customer();
      const b = (await book(c, [{ productId: String(p._id), quantity: 2 }])).body.booking;
      const [a, r] = await Promise.all([status(admin.token, b.id, 'confirmed'), status(staff.token, b.id, 'rejected')]);
      assert.equal([a.status, r.status].filter((s) => s === 200).length, 1);
      const stored = await Booking.findById(b.id);
      assert.equal((await Product.findById(p._id)).stock, stored.status === 'confirmed' ? 3 : 5);
      assert.equal(stored.stockDeducted, stored.status === 'confirmed');
    });

    it('validates the status body and ids', async () => {
      const p = await product(5);
      const c = await customer();
      const b = (await book(c, [{ productId: String(p._id), quantity: 1 }])).body.booking;
      assert.equal((await status(admin.token, b.id, 'pending')).status, 400);
      assert.equal((await status(admin.token, b.id, 'shipped')).status, 400);
      assert.equal((await api('patch', `/admin/bookings/${b.id}/status`, admin.token).send({ status: 'confirmed', isRead: false })).status, 400);
      assert.equal((await api('patch', `/admin/bookings/${oid()}/status`, admin.token).send({ status: 'confirmed' })).status, 404);
      assert.equal((await api('get', '/admin/bookings/not-an-id', admin.token)).status, 400);
    });
  });

  describe('crash recovery', () => {
    // Simulates the server dying part-way through a confirmation: the booking is claimed and only the FIRST
    // item's stock was deducted (marker and stock written together), then nothing else happened.
    const interrupted = async (minutesAgo = 10) => {
      const p = await product(5);
      const q = await product(5);
      const c = await customer();
      const b = (await book(c, [{ productId: String(p._id), quantity: 2 }, { productId: String(q._id), quantity: 3 }])).body.booking;
      await Booking.updateOne({ _id: b.id }, { $set: { stockDeducted: true, claimedAt: new Date(Date.now() - minutesAgo * 60_000) } });
      await Product.updateOne({ _id: p._id }, { $inc: { stock: -2 }, $addToSet: { appliedBookings: b.bookingId } });
      return { p, q, b };
    };

    it('restores exactly the stock that was taken and lets the booking be confirmed again', async () => {
      const { p, q, b } = await interrupted();
      assert.equal(await recoverBookings(), 1);
      assert.equal((await Product.findById(p._id)).stock, 5, 'deducted item restored');
      assert.equal((await Product.findById(q._id)).stock, 5, 'item that was never deducted is NOT inflated');
      const stored = await Booking.findById(b.id);
      assert.deepEqual([stored.status, stored.stockDeducted, stored.claimedAt], ['pending', false, undefined]);
      assert.equal((await Product.findById(p._id).select('+appliedBookings')).appliedBookings.length, 0);
      assert.equal((await api('patch', `/admin/bookings/${b.id}/status`, admin.token).send({ status: 'confirmed' })).status, 200);
      assert.deepEqual([(await Product.findById(p._id)).stock, (await Product.findById(q._id)).stock], [3, 2]);
    });

    it('is safe to run twice and ignores confirmations that are still in progress', async () => {
      const { p, b } = await interrupted(0);
      assert.equal(await recoverBookings(), 0, 'a fresh claim is left alone');
      assert.equal((await Product.findById(p._id)).stock, 3);
      await Booking.updateOne({ _id: b.id }, { $set: { claimedAt: new Date(Date.now() - 10 * 60_000) } });
      assert.equal(await recoverBookings(), 1);
      assert.equal(await recoverBookings(), 0);
      assert.equal((await Product.findById(p._id)).stock, 5, 'restored once, not twice');
    });

    it('never touches a booking that was fully confirmed', async () => {
      const p = await product(5);
      const c = await customer();
      const b = (await book(c, [{ productId: String(p._id), quantity: 2 }])).body.booking;
      await api('patch', `/admin/bookings/${b.id}/status`, admin.token).send({ status: 'confirmed' });
      assert.equal(await recoverBookings({ olderThanMs: 0 }), 0);
      assert.equal((await Product.findById(p._id)).stock, 3);
      assert.equal((await Product.findById(p._id).select('+appliedBookings')).appliedBookings.length, 0, 'markers are cleaned after a normal confirmation');
    });

    it('removes leftover markers of finished bookings', async () => {
      const p = await product(5);
      const c = await customer();
      const b = (await book(c, [{ productId: String(p._id), quantity: 1 }])).body.booking;
      await api('patch', `/admin/bookings/${b.id}/status`, admin.token).send({ status: 'confirmed' });
      await Product.updateOne({ _id: p._id }, { $addToSet: { appliedBookings: b.bookingId } });
      await recoverBookings();
      assert.equal((await Product.findById(p._id).select('+appliedBookings')).appliedBookings.length, 0);
    });
  });

  describe('payments are gone', () => {
    it('has no checkout, payment, webhook, config or invoice endpoints', async () => {
      const c = await customer();
      for (const [method, path] of [['post', '/account/checkout'], ['post', '/account/checkout/verify'], ['get', '/account/orders'], ['post', '/webhooks/razorpay'], ['get', '/store/config'], ['get', '/admin/orders']]) {
        const res = await api(method, path, path.startsWith('/admin') ? admin.token : c.token).send({});
        assert.equal(res.status, 404, `${method} ${path}`);
      }
      assert.ok(!JSON.stringify((await api('get', '/health')).body).includes('payments'));
    });
  });
});
