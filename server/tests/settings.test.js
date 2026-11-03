import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import { Settings } from '../src/models/Settings.js';
import { adminSession, createUser, fixtures, login, setupDb, skipReason, teardownDb } from './helpers/db.js';

describe('store settings', { skip: skipReason }, () => {
  let app;
  let admin;
  const api = (method, path, token) => {
    const r = request(app)[method](`/api/v1${path}`);
    return token ? r.set('Authorization', `Bearer ${token}`) : r;
  };
  const put = (body) => api('put', '/admin/settings', admin.token).send(body);

  before(async () => {
    app = await setupDb();
    admin = await adminSession(app);
  });
  after(teardownDb);

  it('is admin-only: 401 anonymous, 403 customers and staff', async () => {
    const customer = await createUser({ role: 'customer' });
    const staff = await adminSession(app, 'staff');
    const c = await login(app, customer.email);
    for (const [method, path] of [['get', '/admin/settings'], ['put', '/admin/settings'], ['put', '/admin/settings/logo'], ['delete', '/admin/settings/logo']]) {
      assert.equal((await api(method, path)).status, 401, `${method} ${path}`);
      assert.equal((await api(method, path, c.token)).status, 403, `${method} ${path} customer`);
      assert.equal((await api(method, path, staff.token)).status, 403, `${method} ${path} staff`);
    }
  });

  it('starts with no invented business details', async () => {
    await Settings.deleteMany({});
    const s = (await api('get', '/admin/settings', admin.token)).body.settings;
    assert.equal(s.business.address, '');
    assert.equal(s.business.gstin, '');
    assert.equal(s.shipping, undefined, 'no shipping or tax settings exist');
    assert.equal(s.tax, undefined);
  });

  it('persists settings across requests', async () => {
    const res = await put({ business: { name: 'Test Business', address: '1 Sample Road', phone: '+91 98765 43210', email: 'shop@example.com', gstin: '22aaaaa0000a1z5' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.settings.business.gstin, '22AAAAA0000A1Z5', 'normalised to upper case');
    await put({ business: { hours: '10 to 6' } });
    const s = (await api('get', '/admin/settings', admin.token)).body.settings;
    assert.deepEqual([s.business.name, s.business.hours], ['Test Business', '10 to 6']);
    assert.equal(await Settings.countDocuments(), 1, 'a single settings document');
  });

  it('validates every input server-side', async () => {
    const bad = [
      { business: { email: 'nope' } }, { business: { gstin: 'short' } }, { business: { phone: 'abc' } }, { business: { name: 'x' } },
      { business: { role: 'admin' } }, { evil: {} }, { business: { name: 'x'.repeat(101) } },
      { shipping: { mode: 'flat' } }, { tax: { enabled: true } }, // payment-era settings no longer exist
    ];
    for (const body of bad) assert.equal((await put(body)).status, 400, JSON.stringify(body));
  });

  it('shows visitors only public fields (never GSTIN)', async () => {
    await put({ business: { name: 'Public Biz', phone: '12345 67890', gstin: 'ABCDE1234567890' } });
    const res = await api('get', '/store/settings');
    assert.equal(res.status, 200);
    assert.equal(res.body.settings.name, 'Public Biz');
    assert.ok(!/gstin|ABCDE1234567890/i.test(JSON.stringify(res.body)));
  });

  it('stores the logo in GridFS, replaces it without leaking files, and removes it', async () => {
    const files = () => mongoose.connection.db.collection('images.files').countDocuments();
    const base = await files();
    const upload = async () => api('put', '/admin/settings/logo', admin.token).attach('image', await fixtures.png(), { filename: 'logo.png', contentType: 'image/png' });
    const first = await upload();
    assert.equal(first.status, 200);
    assert.equal(await files(), base + 2);
    const url = first.body.settings.business.logo.url;
    assert.equal((await request(app).get(url)).status, 200);
    const second = await upload();
    assert.equal(await files(), base + 2, 'replaced, not leaked');
    assert.notEqual(second.body.settings.business.logo.url, url);
    assert.ok((await api('get', '/store/settings')).body.settings.logo);
    const bad = await api('put', '/admin/settings/logo', admin.token).attach('image', fixtures.notAnImage(), { filename: 'x.png', contentType: 'image/png' });
    assert.equal(bad.status, 400);
    await api('delete', '/admin/settings/logo', admin.token);
    assert.equal(await files(), base);
    assert.equal((await api('get', '/store/settings')).body.settings.logo, null);
  });
});
