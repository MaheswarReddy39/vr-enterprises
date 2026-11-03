import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { Category } from '../src/models/Category.js';
import { Product } from '../src/models/Product.js';
import { User } from '../src/models/User.js';
import { PASSWORD, adminSession, createUser, login, setupDb, skipReason, teardownDb } from './helpers/db.js';

describe('customer accounts, cart and wishlist', { skip: skipReason }, () => {
  let app;
  let category;
  const oid = () => new mongoose.Types.ObjectId();
  const api = (method, path, token) => {
    const r = request(app)[method](`/api/v1${path}`);
    return token ? r.set('Authorization', `Bearer ${token}`) : r;
  };
  let n = 0;
  const make = (overrides = {}) => {
    n += 1;
    return Product.create({
      name: `Item ${n}`, slug: `item-${n}`, sku: `ITM-${String(n).padStart(3, '0')}`, category: category._id,
      price: 1000 + n, stock: 20, status: 'published', images: [{ fileId: oid(), thumbFileId: oid(), isPrimary: true }], ...overrides,
    });
  };
  const signUp = async (email = `c${Math.random().toString(36).slice(2, 8)}@example.com`) => {
    const res = await api('post', '/auth/register').send({ name: 'Cara Customer', email, password: PASSWORD });
    return { res, token: res.body.accessToken, cookie: (res.headers['set-cookie'] ?? []).map((c) => c.split(';')[0]), email };
  };

  before(async () => {
    app = await setupDb();
    category = await Category.create({ name: 'Water', slug: 'water' });
  });
  after(teardownDb);

  describe('registration and profile', () => {
    it('creates a customer, signs them in and sets the httpOnly refresh cookie', async () => {
      const { res, email } = await signUp('New.Person@Example.com');
      assert.equal(res.status, 201);
      assert.equal(res.body.user.role, 'customer');
      assert.equal(res.body.user.email, 'new.person@example.com');
      assert.equal(res.body.user.passwordHash, undefined);
      assert.match(res.headers['set-cookie'].join(';'), /vr_refresh=.*HttpOnly/i);
      assert.ok(email);
      const stored = await User.findOne({ email: 'new.person@example.com' }).select('+passwordHash');
      assert.notEqual(stored.passwordHash, PASSWORD);
      assert.equal((await login(app, 'new.person@example.com')).res.status, 200);
    });

    it('can never create an admin or staff account, whatever the request says', async () => {
      for (const extra of [{ role: 'admin' }, { role: 'staff' }, { isActive: true }, { _id: String(oid()) }]) {
        const res = await api('post', '/auth/register').send({ name: 'Eve Evil', email: `e${Math.random()}@example.com`, password: PASSWORD, ...extra });
        assert.equal(res.status, 400, JSON.stringify(extra));
      }
      assert.equal(await User.countDocuments({ role: { $in: ['admin', 'staff'] } }), 0);
    });

    it('enforces the password policy and rejects duplicate emails', async () => {
      const weak = await api('post', '/auth/register').send({ name: 'Weak Pass', email: 'weak@example.com', password: 'abc' });
      assert.equal(weak.status, 400);
      assert.ok(weak.body.details.some((d) => d.path === 'body.password'));
      await signUp('dup@example.com');
      const dup = await api('post', '/auth/register').send({ name: 'Dup', email: 'DUP@example.com', password: PASSWORD });
      assert.equal(dup.status, 409);
      assert.equal((await api('post', '/auth/register').send({ name: 'x', email: 'bad', password: PASSWORD })).status, 400);
    });

    it('a new customer is locked out of every admin endpoint', async () => {
      const { token } = await signUp();
      for (const path of ['/admin/products', '/admin/enquiries', '/admin/banners', '/admin/dashboard/summary']) {
        assert.equal((await api('get', path, token)).status, 403, path);
      }
    });

    it('lets a customer read and update only their own profile', async () => {
      const { token } = await signUp();
      assert.equal((await api('get', '/account/me', token)).body.user.role, 'customer');
      const updated = await api('patch', '/account/me', token).send({ name: 'Cara Renamed', phone: '+91 98765 43210' });
      assert.equal(updated.body.user.name, 'Cara Renamed');
      assert.equal((await api('patch', '/account/me', token).send({ role: 'admin' })).status, 400);
      assert.equal((await api('patch', '/account/me', token).send({ email: 'other@example.com' })).status, 400);
      assert.equal((await api('get', '/account/me')).status, 401);
    });

    it('changes the password, signs out other sessions and keeps this one', async () => {
      const { token, cookie, email } = await signUp();
      const bad = await api('post', '/account/change-password', token).send({ currentPassword: 'Wrong!Passw0rd1', newPassword: 'N3w!Passw0rd-ok' });
      assert.equal(bad.status, 400);
      assert.equal((await api('post', '/account/change-password', token).send({ currentPassword: PASSWORD, newPassword: 'weak' })).status, 400);

      const ok = await api('post', '/account/change-password', token).send({ currentPassword: PASSWORD, newPassword: 'N3w!Passw0rd-ok' });
      assert.equal(ok.status, 200);
      assert.ok(ok.body.accessToken);
      assert.equal((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie)).status, 401, 'old session revoked');
      assert.equal((await login(app, email, PASSWORD)).res.status, 401);
      assert.equal((await login(app, email, 'N3w!Passw0rd-ok')).res.status, 200);
    });
  });

  describe('guest cart quote (public)', () => {
    it('prices lines from the catalogue and ignores anything the client claims about price', async () => {
      const a = await make({ price: 1500.5 });
      const b = await make({ price: 200 });
      const res = await api('post', '/store/cart/quote').send({ items: [{ productId: String(a._id), quantity: 2 }, { productId: String(b._id), quantity: 1 }] });
      assert.equal(res.status, 200);
      assert.equal(res.body.cart.subtotal, 3201);
      assert.equal(res.body.cart.itemCount, 3);
      assert.equal(res.body.cart.lines[0].lineTotal, 3001);
      const spoof = await api('post', '/store/cart/quote').send({ items: [{ productId: String(a._id), quantity: 1, price: 1 }] });
      assert.equal(spoof.status, 400, 'a client-supplied price is rejected, not used');
    });

    it('merges duplicate lines, reduces quantities to stock and flags unavailable products', async () => {
      const low = await make({ stock: 3 });
      const soldOut = await make({ stock: 0 });
      const draft = await make({ status: 'draft' });
      const res = await api('post', '/store/cart/quote').send({
        items: [
          { productId: String(low._id), quantity: 2 }, { productId: String(low._id), quantity: 4 },
          { productId: String(soldOut._id), quantity: 1 }, { productId: String(draft._id), quantity: 1 }, { productId: String(oid()), quantity: 1 },
        ],
      });
      const [lowLine, soldLine, draftLine, missingLine] = res.body.cart.lines;
      assert.equal(res.body.cart.lines.length, 4);
      assert.deepEqual([lowLine.quantity, lowLine.issue], [3, 'quantity_reduced']);
      assert.deepEqual([soldLine.available, soldLine.issue], [false, 'out_of_stock']);
      assert.deepEqual([draftLine.available, draftLine.issue], [false, 'unavailable']);
      assert.equal(missingLine.issue, 'unavailable');
      assert.equal(res.body.cart.itemCount, 3, 'only available lines count');
      assert.equal(res.body.cart.subtotal, lowLine.price * 3);
      assert.equal(draftLine.name, undefined, 'nothing about an unpublished product is revealed');
    });

    it('validates the request', async () => {
      assert.equal((await api('post', '/store/cart/quote').send({ items: [{ productId: 'bad', quantity: 1 }] })).status, 400);
      assert.equal((await api('post', '/store/cart/quote').send({ items: [{ productId: String(oid()), quantity: 0 }] })).status, 400);
      assert.equal((await api('post', '/store/cart/quote').send({ items: [{ productId: String(oid()), quantity: 11 }] })).status, 400);
      assert.equal((await api('post', '/store/cart/quote').send({ items: Array.from({ length: 21 }, () => ({ productId: String(oid()), quantity: 1 })) })).status, 400);
      assert.equal((await api('post', '/store/cart/quote').send({ items: [] })).body.cart.subtotal, 0);
    });
  });

  describe('account cart', () => {
    it('requires sign-in', async () => {
      assert.equal((await api('get', '/account/cart')).status, 401);
      assert.equal((await api('put', `/account/cart/items/${oid()}`).send({ quantity: 1 })).status, 401);
    });

    it('adds, updates and removes items, always repricing from the catalogue', async () => {
      const { token } = await signUp();
      const p = await make({ price: 999.99 });
      const id = String(p._id);

      const added = await api('put', `/account/cart/items/${id}`, token).send({ quantity: 2 });
      assert.equal(added.status, 200);
      assert.equal(added.body.cart.subtotal, 1999.98);

      await Product.updateOne({ _id: p._id }, { price: 1200 });
      assert.equal((await api('get', '/account/cart', token)).body.cart.subtotal, 2400, 'price change is picked up');

      assert.equal((await api('put', `/account/cart/items/${id}`, token).send({ quantity: 5 })).body.cart.itemCount, 5);
      assert.equal((await api('delete', `/account/cart/items/${id}`, token)).body.cart.lines.length, 0);
    });

    it('rejects invalid quantities, unavailable products and over-stock requests', async () => {
      const { token } = await signUp();
      const few = await make({ stock: 2 });
      const out = await make({ stock: 0 });
      const draft = await make({ status: 'draft' });
      const put = (id, quantity) => api('put', `/account/cart/items/${id}`, token).send({ quantity });
      assert.equal((await put(few._id, 3)).status, 400);
      assert.equal((await put(few._id, 2)).status, 200);
      assert.equal((await put(out._id, 1)).status, 409);
      assert.equal((await put(draft._id, 1)).status, 404);
      assert.equal((await put(oid(), 1)).status, 404);
      assert.equal((await put(few._id, -1)).status, 400);
      assert.equal((await put(few._id, 1.5)).status, 400);
      assert.equal((await put(few._id, 99)).status, 400);
      assert.equal((await api('put', '/account/cart/items/not-an-id', token).send({ quantity: 1 })).status, 400);
    });

    it('limits the number of different products', async () => {
      const { token } = await signUp();
      for (let i = 0; i < 20; i += 1) {
        const p = await make();
        assert.equal((await api('put', `/account/cart/items/${p._id}`, token).send({ quantity: 1 })).status, 200);
      }
      const extra = await make();
      assert.equal((await api('put', `/account/cart/items/${extra._id}`, token).send({ quantity: 1 })).status, 400);
    });

    it('keeps each customer\'s cart private', async () => {
      const a = await signUp();
      const b = await signUp();
      const p = await make();
      await api('put', `/account/cart/items/${p._id}`, a.token).send({ quantity: 1 });
      assert.equal((await api('get', '/account/cart', b.token)).body.cart.itemCount, 0);
    });

    it('merges a guest cart after sign-in without exceeding stock and skipping unavailable items', async () => {
      const { token } = await signUp();
      const p = await make({ stock: 4 });
      const draft = await make({ status: 'draft' });
      await api('put', `/account/cart/items/${p._id}`, token).send({ quantity: 3 });
      const merged = await api('post', '/account/cart/merge', token).send({
        items: [{ productId: String(p._id), quantity: 3 }, { productId: String(draft._id), quantity: 1 }, { productId: String(oid()), quantity: 1 }],
      });
      assert.equal(merged.status, 200);
      assert.equal(merged.body.cart.lines.length, 1);
      assert.equal(merged.body.cart.lines[0].quantity, 4, 'capped at stock');
    });

    it('empties the cart', async () => {
      const { token } = await signUp();
      const p = await make();
      await api('put', `/account/cart/items/${p._id}`, token).send({ quantity: 2 });
      assert.equal((await api('delete', '/account/cart', token)).body.cart.itemCount, 0);
    });

    it('ignores a forged token that claims another user', async () => {
      const victim = await signUp();
      const p = await make();
      await api('put', `/account/cart/items/${p._id}`, victim.token).send({ quantity: 1 });
      const forged = jwt.sign({}, 'x'.repeat(40), { subject: String((await User.findOne({ email: victim.email }))._id), issuer: 'vr-enterprises', audience: 'access' });
      assert.equal((await api('get', '/account/cart', forged)).status, 401);
    });
  });

  describe('wishlist', () => {
    it('adds, lists and removes saved products, only for visible products', async () => {
      const { token } = await signUp();
      const p = await make({ name: 'Wished Item' });
      const draft = await make({ status: 'draft' });
      const added = await api('put', `/account/wishlist/${p._id}`, token);
      assert.deepEqual(added.body.ids, [String(p._id)]);
      assert.equal(added.body.items[0].name, 'Wished Item');
      assert.equal((await api('put', `/account/wishlist/${p._id}`, token)).body.ids.length, 1, 'adding twice does not duplicate');
      assert.equal((await api('put', `/account/wishlist/${draft._id}`, token)).status, 404);
      assert.equal((await api('delete', `/account/wishlist/${p._id}`, token)).body.ids.length, 0);
    });

    it('hides saved products that have since been unpublished, and merges a guest list', async () => {
      const { token } = await signUp();
      const keep = await make();
      const gone = await make();
      const draft = await make({ status: 'draft' });
      const merged = await api('post', '/account/wishlist/merge', token).send({ ids: [String(keep._id), String(gone._id), String(draft._id), String(oid())] });
      assert.equal(merged.body.ids.length, 2);
      await Product.updateOne({ _id: gone._id }, { status: 'archived' });
      assert.deepEqual((await api('get', '/account/wishlist', token)).body.ids, [String(keep._id)]);
    });

    it('requires sign-in and is private per user', async () => {
      assert.equal((await api('get', '/account/wishlist')).status, 401);
      const a = await signUp();
      const b = await signUp();
      const p = await make();
      await api('put', `/account/wishlist/${p._id}`, a.token);
      assert.equal((await api('get', '/account/wishlist', b.token)).body.items.length, 0);
    });

    it('looks up public products by id for guests, in the requested order, visible ones only', async () => {
      const [x, y] = [await make({ name: 'First' }), await make({ name: 'Second' })];
      const draft = await make({ status: 'draft' });
      const res = await api('post', '/store/products/lookup').send({ ids: [String(y._id), String(draft._id), String(x._id)] });
      assert.deepEqual(res.body.items.map((i) => i.name), ['Second', 'First']);
      assert.ok(!JSON.stringify(res.body).includes('createdBy'));
      assert.equal((await api('post', '/store/products/lookup').send({ ids: ['bad'] })).status, 400);
    });
  });

  it('still keeps admin operations separate from customer ones', async () => {
    const admin = await adminSession(app);
    const customer = await createUser({ role: 'customer' });
    const { token } = await login(app, customer.email);
    assert.equal((await request(app).get('/api/v1/admin/products').set(admin.auth)).status, 200);
    assert.equal((await api('get', '/admin/products', token)).status, 403);
  });
});
