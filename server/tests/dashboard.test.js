import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import { Booking } from '../src/models/Booking.js';
import { Category } from '../src/models/Category.js';
import { Product } from '../src/models/Product.js';
import { User } from '../src/models/User.js';
import { PASSWORD, adminSession, createUser, login, setupDb, skipReason, teardownDb } from './helpers/db.js';

describe('dashboard and customer management', { skip: skipReason }, () => {
  let app;
  let admin;
  let staff;
  const api = (method, path, token = admin.token) => request(app)[method](`/api/v1/admin${path}`).set('Authorization', `Bearer ${token}`);
  const oid = () => new mongoose.Types.ObjectId();
  let n = 0;
  const booking = (user, { status = 'pending', isRead = false } = {}) => {
    n += 1;
    return Booking.create({
      bookingId: `VR-BK-T-${String(n).padStart(6, '0')}`, user: user._id, customer: { name: user.name, email: user.email, mobile: '9000000000' },
      items: [{ product: oid(), name: 'Item', sku: 'S', price: 100, quantity: 1, lineTotal: 100 }], total: 100,
      deliveryAddress: { line1: 'Y', city: 'Z', state: 'S', postalCode: '1' }, status, isRead,
    });
  };

  before(async () => {
    app = await setupDb();
    admin = await adminSession(app);
    staff = await adminSession(app, 'staff');
  });
  after(teardownDb);

  describe('authorization', () => {
    it('requires a signed-in admin or staff account (customers get 403)', async () => {
      const customer = await createUser({ role: 'customer' });
      const { token } = await login(app, customer.email);
      for (const path of ['/dashboard/stats', '/customers', `/customers/${customer._id}`]) {
        assert.equal((await request(app).get(`/api/v1/admin${path}`)).status, 401, path);
        assert.equal((await api('get', path, token)).status, 403, path);
        assert.equal((await api('get', path, staff.token)).status, 200, `${path} staff`);
      }
      assert.equal((await api('patch', `/customers/${customer._id}/status`, staff.token).send({ isActive: false })).status, 403);
    });
  });

  describe('dashboard figures', () => {
    it('counts bookings by status, unread alerts, customers, products and recent bookings', async () => {
      const before = (await api('get', '/dashboard/stats')).body;
      const cara = await createUser({ role: 'customer' });
      const dev = await createUser({ role: 'customer' });
      await createUser({ role: 'staff' });
      const category = await Category.create({ name: 'Dash', slug: 'dash' });
      await Product.create([{ name: 'Alpha Unit', slug: 'alpha-unit', sku: 'A-1', category: category._id, price: 1, status: 'published' }, { name: 'Beta Unit', slug: 'beta-unit', sku: 'B-1', category: category._id, price: 1, status: 'draft' }]);
      await booking(cara);
      await booking(cara, { isRead: true });
      await booking(dev, { status: 'confirmed', isRead: true });
      await booking(dev, { status: 'processing', isRead: true });
      await booking(dev, { status: 'completed', isRead: true });
      await booking(dev, { status: 'rejected', isRead: true });
      await booking(dev, { status: 'pending' });

      const s = (await api('get', '/dashboard/stats')).body;
      const d = (key) => s.bookings[key] - before.bookings[key];
      assert.deepEqual([d('total'), d('pending'), d('confirmed'), d('processing'), d('completed'), d('rejected'), d('unread')], [7, 3, 1, 1, 1, 1, 2]);
      assert.equal(s.customers.total - before.customers.total, 2, 'staff and admins are not customers');
      assert.equal(s.products.published, 1);
      assert.equal(s.recentBookings.length, 5);
      assert.ok(s.newBookings.length >= 1 && s.newBookings.every((b) => b.isRead === false));
      assert.ok(s.recentBookings[0].customer.name && s.recentBookings[0].bookingId);
      assert.ok(!/revenue|payment/i.test(JSON.stringify(s)), 'no payment or revenue figures');
    });
  });

  describe('customers', () => {
    it('lists customers with search, status filter and pagination, never exposing credentials', async () => {
      for (let i = 0; i < 4; i += 1) await User.create({ name: `Zed Person ${i}`, email: `zed${i}@example.com`, passwordHash: 'hash'.repeat(10), role: 'customer', phone: `90000000${i}` });
      const all = (await api('get', '/customers?limit=2&page=1')).body;
      assert.equal(all.items.length, 2);
      assert.ok(all.pagination.total >= 4 && all.pagination.totalPages >= 2);
      assert.equal((await api('get', '/customers?q=zed2@example')).body.items.length, 1);
      assert.equal((await api('get', '/customers?q=ZED PERSON')).body.items.length, 4);
      assert.equal((await api('get', '/customers?q=900000003')).body.items.length, 1);
      assert.equal((await api('get', '/customers?q=.*(a+)+$')).status, 200);
      assert.equal((await api('get', '/customers?status=bogus')).status, 400);
      assert.equal((await api('get', '/customers?limit=500')).status, 400);
      assert.ok(!/passwordHash|refreshTokens|tokenHash|lockUntil|failedLoginAttempts|"role"/.test(JSON.stringify(all)));
    });

    it('shows a profile with addresses, booking history and no sensitive data', async () => {
      const user = await User.create({ name: 'Profile Person', email: 'profile@example.com', passwordHash: 'hash'.repeat(10), role: 'customer', addresses: [{ name: 'PP', phone: '123456', line1: '1 Road', city: 'Town', state: 'State', postalCode: '560001', isDefault: true }], refreshTokens: [{ tokenHash: 'secret-token-hash', expiresAt: new Date(Date.now() + 1e9) }] });
      await booking(user);
      await booking(user, { status: 'confirmed' });
      const res = await api('get', `/customers/${user._id}`);
      const c = res.body.customer;
      assert.deepEqual([c.bookingCount, c.recentBookings.length], [2, 2]);
      assert.equal(c.addresses[0].line1, '1 Road');
      assert.ok(!/passwordHash|secret-token-hash|refreshTokens|tokenHash/.test(JSON.stringify(res.body)));
      assert.equal((await api('get', '/customers?q=profile@example.com')).body.items[0].bookingCount, 2);
    });

    it('only exposes customers: admin and staff ids and unknown ids are 404', async () => {
      assert.equal((await api('get', `/customers/${admin.user._id}`)).status, 404);
      assert.equal((await api('get', `/customers/${oid()}`)).status, 404);
      assert.equal((await api('get', '/customers/not-an-id')).status, 400);
      assert.equal((await api('patch', `/customers/${admin.user._id}/status`).send({ isActive: false })).status, 404);
    });

    it('deactivating blocks sign-in and existing tokens immediately; reactivating restores access', async () => {
      const email = 'status@example.com';
      const reg = await request(app).post('/api/v1/auth/register').send({ name: 'Status Person', email, password: PASSWORD });
      const token = reg.body.accessToken;
      const cookie = reg.headers['set-cookie'].map((c) => c.split(';')[0]);
      const id = reg.body.user._id;
      assert.equal((await request(app).get('/api/v1/account/me').set('Authorization', `Bearer ${token}`)).status, 200);

      assert.equal((await api('patch', `/customers/${id}/status`).send({ isActive: false })).body.customer.isActive, false);
      assert.equal((await request(app).get('/api/v1/account/me').set('Authorization', `Bearer ${token}`)).status, 401, 'existing token dies');
      assert.equal((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie)).status, 401, 'session ends');
      assert.equal((await login(app, email, 'Str0ng!Passw0rd')).res.status, 401, 'cannot sign in');
      assert.equal((await api('get', '/customers?status=inactive&q=status@example.com')).body.items.length, 1);

      await api('patch', `/customers/${id}/status`).send({ isActive: true });
      assert.equal((await login(app, email, PASSWORD)).res.status, 200);
      assert.equal((await api('patch', `/customers/${id}/status`).send({ isActive: 'no' })).status, 400);
      assert.equal((await api('patch', `/customers/${id}/status`).send({ isActive: true, role: 'admin' })).status, 400);
    });
  });
});
