// Images are stored in MongoDB GridFS (real database, no mocks).
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import sharp from 'sharp';
import { Product } from '../src/models/Product.js';
import { adminSession, fixtures, setupDb, skipReason, teardownDb } from './helpers/db.js';

describe('product and category images (GridFS)', { skip: skipReason }, () => {
  let app;
  let admin;
  let productId;
  const api = (method, path) => request(app)[method](`/api/v1/admin${path}`).set(admin.auth);
  const files = () => mongoose.connection.db.collection('images.files');
  const chunks = () => mongoose.connection.db.collection('images.chunks');
  const countFiles = () => files().countDocuments();

  const upload = async (id, specs) => {
    const req = api('post', `/products/${id}/images`);
    for (const [name, buffer, type] of specs) req.attach('images', await buffer, { filename: name, contentType: type });
    return req;
  };
  const jpeg = (name = 'a.jpg', color) => [name, fixtures.jpeg(color), 'image/jpeg'];

  before(async () => {
    app = await setupDb();
    admin = await adminSession(app);
    const category = (await api('post', '/categories').send({ name: 'Images' })).body.category._id;
    productId = (await api('post', '/products').send({ name: 'Imaged', price: 10, category })).body.product._id;
  });
  after(teardownDb);

  beforeEach(async () => {
    const product = await Product.findById(productId);
    const { removeImageFiles } = await import('../src/services/image.service.js');
    await removeImageFiles(...product.images);
    await Product.updateOne({ _id: productId }, { $set: { images: [], status: 'draft' } });
  });

  it('cannot publish a product until its price has been entered, even with an image', async () => {
    const category = (await api('post', '/categories').send({ name: 'Needs price' })).body.category._id;
    const id = (await api('post', '/products').send({ name: 'Unpriced', price: 0, category })).body.product._id;
    await upload(id, [jpeg('p.jpg')]);
    const early = await api('patch', `/products/${id}`).send({ status: 'published' });
    assert.equal(early.status, 400);
    assert.match(early.body.message, /price/);
    assert.equal((await api('patch', `/products/${id}`).send({ price: 1500, status: 'published' })).status, 200);
    await api('delete', `/products/${id}`); // leave no files behind: other tests count GridFS files
  });

  it('stores several images in GridFS (not in the product), first one primary, with optimised WebP + thumbnail', async () => {
    const res = await upload(productId, [jpeg('a.jpg'), ['b.png', fixtures.png(), 'image/png'], ['c.webp', fixtures.webp(), 'image/webp']]);
    assert.equal(res.status, 201);
    const { images } = res.body.product;
    assert.equal(images.length, 3);
    assert.deepEqual(images.map((i) => i.isPrimary), [true, false, false]);
    assert.match(images[0].url, /^\/api\/v1\/media\/[a-f0-9]{24}$/);
    assert.notEqual(images[0].thumbUrl, images[0].url);
    assert.equal(images[0].mimeType, 'image/webp');
    assert.equal(await countFiles(), 6, '3 images + 3 thumbnails');

    // The product document itself holds only ids and metadata, never image bytes.
    const raw = await Product.collection.findOne({ _id: new mongoose.Types.ObjectId(productId) });
    assert.ok(JSON.stringify(raw).length < 2000);
    assert.doesNotMatch(JSON.stringify(raw), /base64|data:image/i);
    assert.ok(raw.images[0].fileId instanceof mongoose.Types.ObjectId);
  });

  it('serves stored images through the public media endpoint with safe, cacheable headers', async () => {
    const { images } = (await upload(productId, [jpeg()])).body.product;
    const res = await request(app).get(images[0].url).buffer(true).parse((r, cb) => {
      const parts = [];
      r.on('data', (c) => parts.push(c));
      r.on('end', () => cb(null, Buffer.concat(parts)));
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'image/webp');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.match(res.headers['cache-control'], /immutable/);
    assert.equal(res.headers['cross-origin-resource-policy'], 'cross-origin');
    const meta = await sharp(res.body).metadata();
    assert.equal(meta.format, 'webp');
    assert.equal(meta.width, 200);

    const thumb = await request(app).get(images[0].thumbUrl);
    assert.equal(thumb.status, 200);
  });

  it('supports conditional requests (304) via ETag', async () => {
    const { images } = (await upload(productId, [jpeg()])).body.product;
    const first = await request(app).get(images[0].url);
    const again = await request(app).get(images[0].url).set('If-None-Match', first.headers.etag);
    assert.equal(again.status, 304);
  });

  it('handles missing and invalid media ids safely', async () => {
    assert.equal((await request(app).get('/api/v1/media/5f0000000000000000000000')).status, 404);
    assert.equal((await request(app).get('/api/v1/media/not-an-id')).status, 400);
    const { images } = (await upload(productId, [jpeg()])).body.product;
    // Simulate a lost file: the product still references it, but the GridFS file is gone.
    await files().deleteMany({ _id: new mongoose.Types.ObjectId(images[0].url.split('/').pop()) });
    const missing = await request(app).get(images[0].url);
    assert.equal(missing.status, 404);
    assert.equal(missing.body.success, false);
    assert.equal(missing.headers['content-length'] === undefined || Number(missing.headers['content-length']) < 200, true);
  });

  it('only serves image files, never other GridFS content', async () => {
    const { ObjectId } = mongoose.mongo;
    const id = new ObjectId();
    await files().insertOne({ _id: id, length: 3, chunkSize: 261120, uploadDate: new Date(), filename: 'x.html', contentType: 'text/html' });
    assert.equal((await request(app).get(`/api/v1/media/${id}`)).status, 404);
    await files().deleteOne({ _id: id });
  });

  it('downsizes large images and strips them to web size', async () => {
    const { images } = (await upload(productId, [['big.jpg', fixtures.hugeCanvas(3000, 2000), 'image/jpeg']])).body.product;
    assert.equal(images[0].width, 1600);
    assert.equal(images[0].height, 1067);
    const thumb = sharp(await (await request(app).get(images[0].thumbUrl).buffer(true).parse((r, cb) => { const p = []; r.on('data', (c) => p.push(c)); r.on('end', () => cb(null, Buffer.concat(p))); })).body);
    assert.equal((await thumb.metadata()).width, 480);
  });

  it('rejects unsupported types, spoofed content and corrupt files without storing anything', async () => {
    const before = await countFiles();
    const gif = await upload(productId, [['a.gif', Buffer.from('GIF89a......'), 'image/gif']]);
    assert.equal(gif.status, 400);
    const svg = await upload(productId, [['a.svg', Buffer.from('<svg onload="alert(1)"/>'), 'image/svg+xml']]);
    assert.equal(svg.status, 400);
    const spoofed = await upload(productId, [['evil.jpg', fixtures.notAnImage(), 'image/jpeg']]);
    assert.equal(spoofed.status, 400);
    const wrongKind = await upload(productId, [['liar.png', fixtures.jpeg(), 'image/png']]);
    assert.equal(wrongKind.status, 400);
    const corrupt = await upload(productId, [['broken.jpg', fixtures.corruptJpeg(), 'image/jpeg']]);
    assert.equal(corrupt.status, 400);
    assert.match(corrupt.body.message, /could not be read/);
    assert.equal(await countFiles(), before);
  });

  it('is all-or-nothing: one bad file in a batch stores none of the batch', async () => {
    const before = await countFiles();
    const res = await upload(productId, [jpeg('good.jpg'), ['broken.jpg', fixtures.corruptJpeg(), 'image/jpeg']]);
    assert.equal(res.status, 400);
    assert.equal(await countFiles(), before, 'the good file was rolled back');
    assert.equal((await Product.findById(productId)).images.length, 0);
  });

  it('rejects files over 5 MB with 413', async () => {
    const big = Buffer.concat([await fixtures.jpeg(), Buffer.alloc(5 * 1024 * 1024 + 10, 1)]);
    const res = await upload(productId, [['big.jpg', big, 'image/jpeg']]);
    assert.equal(res.status, 413);
  });

  it('rejects an empty upload and the wrong field name', async () => {
    assert.equal((await api('post', `/products/${productId}/images`)).status, 400);
    const wrongField = await api('post', `/products/${productId}/images`).attach('photo', await fixtures.jpeg(), { filename: 'a.jpg', contentType: 'image/jpeg' });
    assert.equal(wrongField.status, 400);
  });

  it('enforces the 10 image limit', async () => {
    const ten = Array.from({ length: 10 }, (_, i) => jpeg(`${i}.jpg`));
    assert.equal((await upload(productId, ten)).status, 201);
    const filesBefore = await countFiles();
    const extra = await upload(productId, [jpeg('11.jpg')]);
    assert.equal(extra.status, 400);
    assert.equal(await countFiles(), filesBefore);
  });

  it('reorders images, requiring every id exactly once', async () => {
    const { images } = (await upload(productId, [jpeg('1.jpg'), jpeg('2.jpg'), jpeg('3.jpg')])).body.product;
    const ids = images.map((i) => i._id);
    const reversed = [...ids].reverse();
    const ok = await api('put', `/products/${productId}/images/order`).send({ order: reversed });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body.product.images.map((i) => i._id), reversed);
    assert.equal((await api('put', `/products/${productId}/images/order`).send({ order: ids.slice(1) })).status, 400);
    assert.equal((await api('put', `/products/${productId}/images/order`).send({ order: [ids[0], ids[0], ids[1]] })).status, 400);
    assert.equal((await api('put', `/products/${productId}/images/order`).send({ order: [...ids.slice(1), '5f0000000000000000000000'] })).status, 400);
  });

  it('selects exactly one primary image', async () => {
    const { images } = (await upload(productId, [jpeg('1.jpg'), jpeg('2.jpg'), jpeg('3.jpg')])).body.product;
    const res = await api('patch', `/products/${productId}/images/${images[2]._id}/primary`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.product.images.map((i) => i.isPrimary), [false, false, true]);
    assert.equal((await api('patch', `/products/${productId}/images/5f0000000000000000000000/primary`)).status, 404);
  });

  it('deleting an image removes its GridFS files (image + thumbnail); primary moves on', async () => {
    const { images } = (await upload(productId, [jpeg('1.jpg'), jpeg('2.jpg')])).body.product;
    assert.equal(await countFiles(), 4);
    const res = await api('delete', `/products/${productId}/images/${images[0]._id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.product.images.length, 1);
    assert.equal(res.body.product.images[0].isPrimary, true);
    assert.equal(await countFiles(), 2);
    assert.equal((await request(app).get(images[0].url)).status, 404);
    assert.equal((await api('delete', `/products/${productId}/images/${images[0]._id}`)).status, 404);
  });

  it('also removes the file chunks, not just the file records', async () => {
    const { images } = (await upload(productId, [jpeg('1.jpg'), jpeg('2.jpg')])).body.product;
    const target = new mongoose.Types.ObjectId(images[0].url.split('/').pop());
    assert.ok((await chunks().countDocuments({ files_id: target })) > 0);
    await api('delete', `/products/${productId}/images/${images[0]._id}`);
    assert.equal(await chunks().countDocuments({ files_id: target }), 0);
  });

  it('publishes only with an image, and blocks deleting the last image of a published product', async () => {
    assert.equal((await api('patch', `/products/${productId}`).send({ status: 'published' })).status, 400);
    const { images } = (await upload(productId, [jpeg()])).body.product;
    assert.equal((await api('patch', `/products/${productId}`).send({ status: 'published' })).status, 200);
    const blocked = await api('delete', `/products/${productId}/images/${images[0]._id}`);
    assert.equal(blocked.status, 409);
    assert.equal(await countFiles(), 2, 'files untouched');
  });

  it('removes every GridFS file when a product is permanently deleted', async () => {
    const category = (await api('post', '/categories').send({ name: 'Doomed Cat' })).body.category._id;
    const doomed = (await api('post', '/products').send({ name: 'Doomed', price: 1, category })).body.product._id;
    await upload(doomed, [jpeg('1.jpg'), jpeg('2.jpg')]);
    const before = await countFiles();
    assert.equal((await api('delete', `/products/${doomed}`)).status, 200);
    assert.equal(await countFiles(), before - 4);
  });

  it('manages a category image: upload, replace (old files deleted), remove', async () => {
    const category = (await api('post', '/categories').send({ name: 'With Image' })).body.category;
    const put = async (buffer, type) =>
      api('put', `/categories/${category._id}/image`).attach('image', await buffer, { filename: 'c.jpg', contentType: type });
    const base = await countFiles();

    const first = await put(fixtures.jpeg(), 'image/jpeg');
    assert.equal(first.status, 200);
    assert.match(first.body.category.image.url, /^\/api\/v1\/media\//);
    assert.equal(await countFiles(), base + 2);

    const second = await put(fixtures.png(), 'image/png');
    assert.notEqual(second.body.category.image.url, first.body.category.image.url);
    assert.equal(await countFiles(), base + 2, 'old image replaced, not leaked');
    assert.equal((await request(app).get(first.body.category.image.url)).status, 404);

    assert.equal((await put(fixtures.notAnImage(), 'image/jpeg')).status, 400);

    const removed = await api('delete', `/categories/${category._id}/image`);
    assert.equal(removed.body.category.image, undefined);
    assert.equal(await countFiles(), base);
  });

  it('requires authentication to upload or delete, but not to view', async () => {
    const { images } = (await upload(productId, [jpeg()])).body.product;
    const noAuthUpload = await request(app).post(`/api/v1/admin/products/${productId}/images`).attach('images', await fixtures.jpeg(), { filename: 'a.jpg', contentType: 'image/jpeg' });
    assert.equal(noAuthUpload.status, 401);
    assert.equal((await request(app).delete(`/api/v1/admin/products/${productId}/images/${images[0]._id}`)).status, 401);
    assert.equal((await request(app).get(images[0].url)).status, 200);
  });
});
