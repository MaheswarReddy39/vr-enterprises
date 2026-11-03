import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { User } from '../src/models/User.js';
import { PASSWORD, createUser, login, setupDb, skipReason, teardownDb } from './helpers/db.js';

describe('authentication and authorization', { skip: skipReason }, () => {
  let app;
  before(async () => {
    app = await setupDb();
  });
  after(teardownDb);

  it('logs in an admin, returns an access token and sets an httpOnly refresh cookie', async () => {
    const admin = await createUser({ role: 'admin' });
    const { res } = await login(app, admin.email);
    assert.equal(res.status, 200);
    assert.ok(res.body.accessToken);
    assert.equal(res.body.user.email, admin.email);
    assert.equal(res.body.user.passwordHash, undefined);
    assert.equal(res.body.user.refreshTokens, undefined);

    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('vr_refresh='));
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /Path=\/api\/v1\/auth/);
    assert.doesNotMatch(JSON.stringify(res.body), /refreshToken/);
  });

  it('gives the same generic error for a wrong password and an unknown email', async () => {
    const admin = await createUser({ role: 'admin' });
    const wrong = await login(app, admin.email, 'Wrong!Passw0rd1');
    const unknown = await login(app, 'nobody@example.com', 'Wrong!Passw0rd1');
    assert.equal(wrong.res.status, 401);
    assert.equal(unknown.res.status, 401);
    assert.equal(wrong.res.body.message, unknown.res.body.message);
  });

  it('locks the account after repeated failures, even with the right password', async () => {
    const admin = await createUser({ role: 'admin' });
    for (let i = 0; i < 5; i += 1) await login(app, admin.email, 'Wrong!Passw0rd1');
    const { res } = await login(app, admin.email, PASSWORD);
    assert.equal(res.status, 429);
  });

  it('rejects inactive accounts', async () => {
    const user = await createUser({ role: 'admin', isActive: false });
    assert.equal((await login(app, user.email)).res.status, 401);
  });

  it('offers no way to register an administrator', async () => {
    // Customer sign-up exists (see customer.test.js) but cannot set a role; other admin-creation routes do not exist.
    for (const path of ['/api/v1/auth/signup', '/api/v1/admin/users']) {
      const res = await request(app).post(path).send({ name: 'Eve', email: 'eve@example.com', password: PASSWORD, role: 'admin' });
      assert.ok([401, 404].includes(res.status), `${path} returned ${res.status}`);
    }
    const attempt = await request(app).post('/api/v1/auth/register').send({ name: 'Eve', email: 'eve@example.com', password: PASSWORD, role: 'admin' });
    assert.equal(attempt.status, 400);
    assert.equal(await User.countDocuments({ email: 'eve@example.com' }), 0);
  });

  it('refresh rotates the token and detects reuse of an old one', async () => {
    const admin = await createUser({ role: 'admin' });
    const first = await login(app, admin.email);

    const rotated = await request(app).post('/api/v1/auth/refresh').set('Cookie', first.cookie);
    assert.equal(rotated.status, 200);
    assert.ok(rotated.body.accessToken);
    const newCookie = rotated.headers['set-cookie'].map((c) => c.split(';')[0]);

    // Replaying the OLD token = theft signal: it fails and revokes every session.
    const replay = await request(app).post('/api/v1/auth/refresh').set('Cookie', first.cookie);
    assert.equal(replay.status, 401);
    const afterRevoke = await request(app).post('/api/v1/auth/refresh').set('Cookie', newCookie);
    assert.equal(afterRevoke.status, 401);
  });

  it('logout revokes the refresh token and clears the cookie', async () => {
    const admin = await createUser({ role: 'admin' });
    const { cookie } = await login(app, admin.email);
    const out = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    assert.equal(out.status, 200);
    assert.match(out.headers['set-cookie'].join(';'), /vr_refresh=;/);
    assert.equal((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie)).status, 401);
  });

  it('refuses refresh without a cookie', async () => {
    assert.equal((await request(app).post('/api/v1/auth/refresh')).status, 401);
  });

  it('GET /auth/me requires a token', async () => {
    assert.equal((await request(app).get('/api/v1/auth/me')).status, 401);
    const admin = await createUser({ role: 'admin' });
    const { token } = await login(app, admin.email);
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.user.role, 'admin');
  });

  describe('admin API protection', () => {
    const endpoints = [
      ['get', '/api/v1/admin/products'],
      ['post', '/api/v1/admin/products'],
      ['get', '/api/v1/admin/categories'],
      ['post', '/api/v1/admin/categories'],
      ['get', '/api/v1/admin/brands'],
      ['post', '/api/v1/admin/brands'],
      ['get', '/api/v1/admin/inventory/logs'],
      ['get', '/api/v1/admin/dashboard/summary'],
      ['delete', '/api/v1/admin/products/000000000000000000000000'],
      ['post', '/api/v1/admin/products/000000000000000000000000/images'],
    ];

    it('returns 401 for every admin endpoint without a token', async () => {
      for (const [method, path] of endpoints) {
        const res = await request(app)[method](path);
        assert.equal(res.status, 401, `${method.toUpperCase()} ${path}`);
      }
    });

    it('returns 403 for a signed-in customer on every admin endpoint', async () => {
      const customer = await createUser({ role: 'customer' });
      const { token } = await login(app, customer.email);
      for (const [method, path] of endpoints) {
        const res = await request(app)[method](path).set('Authorization', `Bearer ${token}`);
        assert.equal(res.status, 403, `${method.toUpperCase()} ${path}`);
      }
    });

    it('rejects malformed, wrongly-signed and wrong-audience tokens', async () => {
      const admin = await createUser({ role: 'admin' });
      const forged = jwt.sign({}, 'x'.repeat(40), { subject: String(admin._id), issuer: 'vr-enterprises', audience: 'access' });
      const wrongAudience = jwt.sign({}, process.env.JWT_REFRESH_SECRET, { subject: String(admin._id), issuer: 'vr-enterprises', audience: 'refresh' });
      for (const token of ['garbage', forged, wrongAudience]) {
        const res = await request(app).get('/api/v1/admin/products').set('Authorization', `Bearer ${token}`);
        assert.equal(res.status, 401);
      }
    });

    it('ignores a role claim inside the token: the database is the source of truth', async () => {
      const customer = await createUser({ role: 'customer' });
      const token = jwt.sign({ role: 'admin' }, process.env.JWT_ACCESS_SECRET, {
        subject: String(customer._id), issuer: 'vr-enterprises', audience: 'access', expiresIn: 60,
      });
      const res = await request(app).get('/api/v1/admin/products').set('Authorization', `Bearer ${token}`);
      assert.equal(res.status, 403);
    });

    it('stops honouring tokens as soon as the account is deactivated', async () => {
      const admin = await createUser({ role: 'admin' });
      const { token } = await login(app, admin.email);
      await User.updateOne({ _id: admin._id }, { isActive: false });
      const res = await request(app).get('/api/v1/admin/products').set('Authorization', `Bearer ${token}`);
      assert.equal(res.status, 401);
    });

    it('lets staff read and write but reserves deletes for admins', async () => {
      const staff = await createUser({ role: 'staff' });
      const { token } = await login(app, staff.email);
      const auth = { Authorization: `Bearer ${token}` };
      assert.equal((await request(app).get('/api/v1/admin/products').set(auth)).status, 200);
      const created = await request(app).post('/api/v1/admin/categories').set(auth).send({ name: 'Staff Category' });
      assert.equal(created.status, 201);
      const del = await request(app).delete(`/api/v1/admin/categories/${created.body.category._id}`).set(auth);
      assert.equal(del.status, 403);
    });
  });
});
