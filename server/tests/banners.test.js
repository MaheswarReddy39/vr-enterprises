import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import { isSafeLink } from '../src/validators/banner.validators.js';
import { adminSession, createUser, fixtures, login, setupDb, skipReason, teardownDb } from './helpers/db.js';

describe('isSafeLink', () => {
  it('accepts site paths, https URLs and empty', () => {
    for (const ok of ['', '/shop', '/shop?category=water&sort=price_asc', '/product/some-slug#specs', 'https://example.com/offer']) assert.equal(isSafeLink(ok), true, ok);
  });
  it('rejects scripts, protocol-relative, http, data and malformed links', () => {
    for (const bad of ['javascript:alert(1)', '//evil.example', 'http://example.com', 'data:text/html,hi', 'shop', ' /shop with space', 'ftp://x.test', '/\\evil']) assert.equal(isSafeLink(bad), false, bad);
  });
});

describe('homepage banners', { skip: skipReason }, () => {
  let app;
  let admin;
  const adminApi = (method, path) => request(app)[method](`/api/v1/admin${path}`).set(admin.auth);
  const files = () => mongoose.connection.db.collection('images.files').countDocuments();
  const pub = () => request(app).get('/api/v1/store/banners');
  const withImage = async (id) =>
    adminApi('put', `/banners/${id}/image`).attach('image', await fixtures.jpeg('#264c55', 1600, 700), { filename: 'b.jpg', contentType: 'image/jpeg' });
  const create = async (body = {}) => (await adminApi('post', '/banners').send({ title: 'Sale', ...body })).body.banner;

  before(async () => {
    app = await setupDb();
    admin = await adminSession(app);
  });
  after(teardownDb);

  it('is protected: 401 without a token, 403 for customers and staff cannot delete', async () => {
    assert.equal((await request(app).get('/api/v1/admin/banners')).status, 401);
    const customer = await createUser({ role: 'customer' });
    const { token } = await login(app, customer.email);
    assert.equal((await request(app).get('/api/v1/admin/banners').set('Authorization', `Bearer ${token}`)).status, 403);
    assert.equal((await request(app).post('/api/v1/admin/banners').set('Authorization', `Bearer ${token}`).send({ title: 'Hack' })).status, 403);

    const staff = await adminSession(app, 'staff');
    const banner = await create({ title: 'Staff Banner' });
    assert.equal((await request(app).delete(`/api/v1/admin/banners/${banner._id}`).set(staff.auth)).status, 403);
  });

  it('creates, edits and validates banners', async () => {
    const created = await adminApi('post', '/banners').send({ title: 'Festive Offer', subtitle: 'Sub', ctaLabel: 'Shop now', linkUrl: '/shop' });
    assert.equal(created.status, 201);
    assert.equal(created.body.banner.isActive, true);
    const id = created.body.banner._id;
    assert.equal((await adminApi('patch', `/banners/${id}`).send({ title: 'Renamed', isActive: false })).body.banner.title, 'Renamed');

    assert.equal((await adminApi('post', '/banners').send({ title: 'x' })).status, 400);
    assert.equal((await adminApi('post', '/banners').send({ title: 'Bad link', linkUrl: 'javascript:alert(1)' })).status, 400);
    assert.equal((await adminApi('post', '/banners').send({ title: 'Bad link', linkUrl: 'http://insecure.example' })).status, 400);
    assert.equal((await adminApi('post', '/banners').send({ title: 'Mass', sortOrder: 5 })).status, 400, 'unknown fields rejected');
    assert.equal((await adminApi('post', '/banners').send({ title: 'Dates', startsAt: '2030-02-01', endsAt: '2030-01-01' })).status, 400);
  });

  it('only shows active, scheduled banners that have a picture, in order', async () => {
    const before = (await pub()).body.items.length;
    const noImage = await create({ title: 'No picture' });
    const live = await create({ title: 'Live Banner' });
    await withImage(live._id);
    const off = await create({ title: 'Inactive Banner', isActive: false });
    await withImage(off._id);
    const future = await create({ title: 'Future Banner', startsAt: new Date(Date.now() + 86_400_000).toISOString() });
    await withImage(future._id);
    const expired = await create({ title: 'Expired Banner', startsAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), endsAt: new Date(Date.now() - 86_400_000).toISOString() });
    await withImage(expired._id);

    const titles = (await pub()).body.items.map((b) => b.title);
    assert.ok(titles.includes('Live Banner'));
    for (const hidden of ['No picture', 'Inactive Banner', 'Future Banner', 'Expired Banner']) assert.ok(!titles.includes(hidden), hidden);
    assert.equal(titles.length, before + 1);
    assert.ok(noImage);
  });

  it('exposes only display fields publicly', async () => {
    const [banner] = (await pub()).body.items;
    assert.deepEqual(Object.keys(banner).sort(), ['ctaLabel', 'id', 'image', 'linkUrl', 'subtitle', 'title']);
    assert.match(banner.image.url, /^\/api\/v1\/media\/[a-f0-9]{24}$/);
    assert.equal((await request(app).get(banner.image.url)).status, 200);
  });

  it('manages the picture in GridFS: replace deletes the old files, remove hides the banner, delete cleans up', async () => {
    const banner = await create({ title: 'Picture Banner' });
    const base = await files();
    const first = await withImage(banner._id);
    assert.equal(first.status, 200);
    assert.equal(await files(), base + 2);
    const second = await withImage(banner._id);
    assert.equal(await files(), base + 2, 'replaced, not leaked');
    assert.notEqual(second.body.banner.image.url, first.body.banner.image.url);

    const bad = await adminApi('put', `/banners/${banner._id}/image`).attach('image', fixtures.notAnImage(), { filename: 'x.jpg', contentType: 'image/jpeg' });
    assert.equal(bad.status, 400);

    await adminApi('delete', `/banners/${banner._id}/image`);
    assert.equal(await files(), base);
    assert.ok(!(await pub()).body.items.some((b) => b.title === 'Picture Banner'));

    await withImage(banner._id);
    assert.equal((await adminApi('delete', `/banners/${banner._id}`)).status, 200);
    assert.equal(await files(), base, 'deleting a banner deletes its image files');
  });

  it('reorders banners, requiring every banner exactly once', async () => {
    const list = (await adminApi('get', '/banners')).body.items;
    const ids = list.map((b) => b._id);
    const reversed = [...ids].reverse();
    const ok = await adminApi('put', '/banners/order').send({ order: reversed });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body.items.map((b) => b._id), reversed);
    assert.equal((await adminApi('put', '/banners/order').send({ order: ids.slice(1) })).status, 400);
    assert.equal((await adminApi('put', '/banners/order').send({ order: [ids[0], ids[0], ...ids.slice(2)] })).status, 400);
  });

  it('returns 404 for unknown banners and 400 for malformed ids', async () => {
    assert.equal((await adminApi('patch', '/banners/5f0000000000000000000000').send({ title: 'Nope' })).status, 404);
    assert.equal((await adminApi('patch', '/banners/not-an-id').send({ title: 'Nope' })).status, 400);
  });
});
