import assert from 'node:assert/strict';
import { afterEach, after, before, describe, it, mock } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import { Booking } from '../src/models/Booking.js';
import { Category } from '../src/models/Category.js';
import { Notification } from '../src/models/Notification.js';
import { Product } from '../src/models/Product.js';
import { notify, settled } from '../src/services/notification.service.js';
import { maskNumber, normalizeIndianMobile, redact, setConfigForTests } from '../src/services/whatsapp.service.js';
import { PASSWORD, adminSession, setupDb, skipReason, teardownDb } from './helpers/db.js';

const TOKEN = 'EAAFAKEFAKEFAKEFAKEFAKEFAKEFAKE123456789';
const CONFIG = { accessToken: TOKEN, phoneNumberId: '123456789012345', adminNumber: '919346411218', apiVersion: 'v21.0', adminTemplate: 'vr_new_booking_alert', customerTemplate: 'vr_booking_status_update', language: 'en', businessContact: '9346411218' };

describe('Indian mobile numbers', () => {
  it('normalises every common way of writing one to 91XXXXXXXXXX', () => {
    for (const input of ['9346411218', '+91 93464 11218', '919346411218', '09346411218', '0091 93464-11218', ' (+91) 9346411218 ']) assert.equal(normalizeIndianMobile(input), '919346411218', input);
  });
  it('rejects anything that is not an Indian mobile number', () => {
    for (const input of ['', null, undefined, '12345', '5346411218', '93464112', '934641121890', '+44 7911 123456', 'abc']) assert.equal(normalizeIndianMobile(input), null, String(input));
  });
  it('masks numbers for screens and redacts tokens from text', () => {
    assert.equal(maskNumber('919346411218'), '+91 ••••• 11218');
    assert.ok(!redact(`bad token ${TOKEN} and Bearer ${TOKEN}`, TOKEN).includes(TOKEN));
    assert.ok(!redact('EAAB1234567890123456789012345678', null).includes('EAAB1234'));
  });
});

describe('WhatsApp notifications', { skip: skipReason }, () => {
  let app;
  let admin;
  let staff;
  let category;
  let fetchMock;
  const calls = () => fetchMock.mock.calls.map((c) => ({ url: c.arguments[0], init: c.arguments[1], body: JSON.parse(c.arguments[1].body) }));
  const respond = (status, body) => async () => ({ ok: status < 400, status, json: async () => body });
  const OK = (id = 'wamid.HBgM1') => respond(200, { messages: [{ id }] });
  const mockFetch = (impl) => { fetchMock = mock.method(globalThis, 'fetch', impl); };

  const api = (method, path, token) => {
    const r = request(app)[method](`/api/v1${path}`);
    return token ? r.set('Authorization', `Bearer ${token}`) : r;
  };
  const address = { line1: '12 Test Road', city: 'Town', state: 'State', postalCode: '560001' };
  let n = 0;
  const product = (stock = 10) => {
    n += 1;
    return Product.create({ name: `Notif Purifier ${n}`, slug: `notif-${n}-${Math.random().toString(36).slice(2, 6)}`, sku: `NT-${n}${Math.random().toString(36).slice(2, 6).toUpperCase()}`, category: category._id, price: 1000, stock, status: 'published', images: [{ fileId: new mongoose.Types.ObjectId(), thumbFileId: new mongoose.Types.ObjectId(), isPrimary: true }] });
  };
  const customer = async () => {
    const res = await api('post', '/auth/register').send({ name: 'Cara Customer', email: `c${Math.random().toString(36).slice(2, 8)}@example.com`, password: PASSWORD });
    return { token: res.body.accessToken };
  };
  const book = async (c, p, { mobile = '98765 43210', quantity = 2 } = {}) => {
    const res = await api('post', '/account/bookings', c.token).send({ name: 'Cara Customer', mobile, address, items: [{ productId: String(p._id), quantity }] });
    await settled();
    return res;
  };
  const status = async (id, s) => {
    const res = await api('patch', `/admin/bookings/${id}/status`, admin.token).send({ status: s });
    await settled();
    return res;
  };

  before(async () => {
    app = await setupDb();
    admin = await adminSession(app);
    staff = await adminSession(app, 'staff');
    category = await Category.create({ name: 'Notif', slug: 'notif' });
  });
  after(teardownDb);
  afterEach(async () => {
    fetchMock?.mock.restore();
    fetchMock = null;
    setConfigForTests(null);
    await Notification.deleteMany({});
  });

  describe('when a customer submits a booking', () => {
    it('sends the business an approved-template alert with name, booking ID, product, quantity and contact number', async () => {
      setConfigForTests(CONFIG);
      mockFetch(OK());
      const p = await product();
      const res = await book(await customer(), p);
      assert.equal(res.status, 201);
      const [call] = calls();
      assert.equal(call.url, 'https://graph.facebook.com/v21.0/123456789012345/messages');
      assert.equal(call.init.headers.Authorization, `Bearer ${TOKEN}`);
      assert.equal(call.body.messaging_product, 'whatsapp');
      assert.equal(call.body.to, '919346411218');
      assert.equal(call.body.type, 'template');
      assert.deepEqual([call.body.template.name, call.body.template.language.code], ['vr_new_booking_alert', 'en']);
      const text = call.body.template.components[0].parameters.map((x) => x.text);
      assert.deepEqual(text, ['VR Enterprises', res.body.booking.bookingId, 'Cara Customer', '98765 43210', `${p.name} x 2`, '9346411218']);
      const saved = await Notification.findOne({ bookingId: res.body.booking.bookingId });
      assert.deepEqual([saved.kind, saved.state, saved.attempts, saved.providerMessageId], ['admin_new_booking', 'sent', 1, 'wamid.HBgM1']);
    });

    it('sends nothing at all and keeps the booking when WhatsApp is not configured (message saved as skipped)', async () => {
      mockFetch(OK());
      const res = await book(await customer(), await product());
      assert.equal(res.status, 201);
      assert.equal(calls().length, 0, 'no network call without credentials');
      const saved = await Notification.findOne({ bookingId: res.body.booking.bookingId });
      assert.equal(saved.state, 'skipped');
      assert.match(saved.lastError, /not configured/i);
    });

    it('a WhatsApp error never fails the booking, and the token never reaches the database or the API', async () => {
      setConfigForTests(CONFIG);
      mockFetch(respond(401, { error: { message: `Invalid OAuth access token ${TOKEN}`, code: 190 } }));
      const p = await product();
      const res = await book(await customer(), p);
      assert.equal(res.status, 201);
      assert.equal(await Booking.countDocuments({ bookingId: res.body.booking.bookingId }), 1);
      const saved = await Notification.findOne({ bookingId: res.body.booking.bookingId });
      assert.equal(saved.state, 'failed');
      assert.match(saved.lastError, /190/);
      assert.ok(!JSON.stringify(saved.toObject()).includes(TOKEN));
      const list = await api('get', '/admin/notifications', admin.token);
      assert.ok(!JSON.stringify(list.body).includes(TOKEN));
      assert.ok(!JSON.stringify(res.body).includes(TOKEN));
    });

    it('records a clear failure, and calls nothing, while the business number has not been added to the server settings', async () => {
      setConfigForTests({ ...CONFIG, adminNumber: undefined });
      mockFetch(OK());
      const res = await book(await customer(), await product());
      assert.equal(res.status, 201);
      assert.equal(calls().length, 0);
      const saved = await Notification.findOne({ bookingId: res.body.booking.bookingId });
      assert.equal(saved.state, 'failed');
      assert.match(saved.lastError, /WHATSAPP_ADMIN_NUMBER/);
    });

    it('a network failure or timeout is also contained', async () => {
      setConfigForTests(CONFIG);
      mockFetch(async () => { throw new TypeError('fetch failed'); });
      const res = await book(await customer(), await product());
      assert.equal(res.status, 201);
      assert.equal((await Notification.findOne({ bookingId: res.body.booking.bookingId })).state, 'failed');
    });

    it('a duplicate submission does not send a second alert', async () => {
      setConfigForTests(CONFIG);
      mockFetch(OK());
      const c = await customer();
      const p = await product();
      const [a] = await Promise.all([book(c, p), book(c, p)]);
      await settled();
      assert.equal(await Notification.countDocuments({ bookingId: a.body.booking.bookingId }), 1);
      assert.equal(calls().length, 1);
    });
  });

  describe('when the admin changes the status', () => {
    it('sends the customer one update per status to the +91 number, with name, booking ID, product and contact', async () => {
      setConfigForTests(CONFIG);
      mockFetch(OK());
      const p = await product();
      const b = (await book(await customer(), p, { mobile: '+91 98765-43210' })).body.booking;
      fetchMock.mock.resetCalls();
      for (const s of ['confirmed', 'processing', 'completed']) assert.equal((await status(b.id, s)).status, 200);
      const sent = calls();
      assert.equal(sent.length, 3);
      assert.deepEqual(sent.map((c) => c.body.to), ['919876543210', '919876543210', '919876543210']);
      assert.deepEqual(sent.map((c) => c.body.template.name), Array(3).fill('vr_booking_status_update'));
      const params = sent.map((c) => c.body.template.components[0].parameters.map((x) => x.text));
      assert.deepEqual(params.map((x) => x[4]), ['Confirmed', 'Processing', 'Completed']);
      assert.deepEqual(params[0], ['VR Enterprises', 'Cara Customer', b.bookingId, `${p.name} x 2`, 'Confirmed', '9346411218']);
    });

    it('sends the Rejected update too', async () => {
      setConfigForTests(CONFIG);
      mockFetch(OK());
      const b = (await book(await customer(), await product())).body.booking;
      fetchMock.mock.resetCalls();
      await status(b.id, 'rejected');
      assert.equal(calls()[0].body.template.components[0].parameters[4].text, 'Rejected');
    });

    it('never sends the same status message twice, even if the update is repeated or notify is called again', async () => {
      setConfigForTests(CONFIG);
      mockFetch(OK());
      const b = (await book(await customer(), await product())).body.booking;
      fetchMock.mock.resetCalls();
      assert.equal((await status(b.id, 'confirmed')).status, 200);
      assert.equal((await status(b.id, 'confirmed')).status, 409, 'repeating the status is refused');
      const doc = await Booking.findById(b.id);
      await Promise.all([notify('customer_status', doc, 'confirmed'), notify('customer_status', doc, 'confirmed')]);
      assert.equal(calls().length, 1);
      assert.equal(await Notification.countDocuments({ bookingId: b.bookingId, kind: 'customer_status', status: 'confirmed' }), 1);
    });

    it('a failed update never blocks the status change or the stock deduction', async () => {
      setConfigForTests(CONFIG);
      mockFetch(respond(500, { error: { message: 'Temporary problem', code: 2 } }));
      const p = await product(10);
      const b = (await book(await customer(), p)).body.booking;
      const res = await status(b.id, 'confirmed');
      assert.equal(res.status, 200);
      assert.equal(res.body.booking.status, 'confirmed');
      assert.equal((await Product.findById(p._id)).stock, 8);
      assert.equal((await Notification.findOne({ bookingId: b.bookingId, kind: 'customer_status' })).state, 'failed');
    });

    it('records an invalid customer number as failed without calling WhatsApp for it', async () => {
      setConfigForTests(CONFIG);
      mockFetch(OK());
      const b = (await book(await customer(), await product(), { mobile: '12345 678' })).body.booking;
      fetchMock.mock.resetCalls();
      await status(b.id, 'confirmed');
      assert.equal(calls().length, 0);
      const saved = await Notification.findOne({ bookingId: b.bookingId, kind: 'customer_status' });
      assert.equal(saved.state, 'failed');
      assert.match(saved.lastError, /valid Indian mobile/);
    });
  });

  describe('admin panel: log and retry', () => {
    it('lists notifications with masked numbers and retries failed ones exactly once', async () => {
      setConfigForTests(CONFIG);
      mockFetch(respond(500, { error: { message: 'Temporary problem', code: 2 } }));
      const b = (await book(await customer(), await product())).body.booking;
      const list = (await api('get', '/admin/notifications?state=failed', admin.token)).body;
      assert.equal(list.items.length, 1);
      assert.equal(list.items[0].to, '+91 ••••• 11218');
      assert.equal(list.failedCount, 1);
      assert.equal(list.whatsapp.configured, true);
      assert.ok(!JSON.stringify(list).includes('919346411218'), 'full numbers are not sent to the screen');

      fetchMock.mock.restore();
      mockFetch(OK('wamid.RETRY'));
      const id = list.items[0].id;
      const retry = await api('post', `/admin/notifications/${id}/retry`, staff.token);
      assert.equal(retry.status, 200);
      assert.deepEqual([retry.body.notification.state, retry.body.notification.attempts], ['sent', 2]);
      assert.equal((await api('post', `/admin/notifications/${id}/retry`, admin.token)).status, 409, 'a sent message is never sent again');
      assert.equal(calls().length, 1);
      assert.equal((await api('get', `/admin/notifications?booking=${b.id}`, admin.token)).body.items.length, 1);
    });

    it('lets a skipped message be sent after the credentials are added', async () => {
      mockFetch(OK('wamid.LATER'));
      await book(await customer(), await product());
      const skipped = (await api('get', '/admin/notifications?state=skipped', admin.token)).body;
      assert.equal(skipped.items.length, 1);
      assert.equal(skipped.whatsapp.configured, false);
      setConfigForTests(CONFIG);
      const retry = await api('post', `/admin/notifications/${skipped.items[0].id}/retry`, admin.token);
      assert.equal(retry.body.notification.state, 'sent');
    });

    it('is closed to anonymous users and customers, and the dashboard counts failures', async () => {
      const c = await customer();
      const id = new mongoose.Types.ObjectId();
      for (const [method, path] of [['get', '/admin/notifications'], ['post', `/admin/notifications/${id}/retry`]]) {
        assert.equal((await api(method, path)).status, 401);
        assert.equal((await api(method, path, c.token)).status, 403);
      }
      assert.equal((await api('post', `/admin/notifications/${id}/retry`, admin.token)).status, 404);
      assert.equal((await api('get', '/admin/notifications?state=bogus', admin.token)).status, 400);
      await Notification.create({ booking: id, bookingId: 'VR-BK-X', kind: 'customer_status', template: 't', state: 'failed', dedupeKey: 'dash-test' });
      assert.equal((await api('get', '/admin/dashboard/stats', admin.token)).body.notifications.failed, 1);
    });
  });
});
