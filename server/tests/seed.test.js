// Runs the real demo seed script against a throwaway database (replica set required).
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { after, before, describe, it } from 'node:test';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { InventoryLog } from '../src/models/InventoryLog.js';
import { Product } from '../src/models/Product.js';
import { User } from '../src/models/User.js';
import { skipReason, mongoUri } from './helpers/db.js';

const run = promisify(execFile);
const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scripts/seed-demo.js');

describe('demo seed script', { skip: skipReason }, () => {
  let uri;
  const seed = (...args) =>
    run(process.execPath, [script, ...args], { env: { ...process.env, MONGODB_URI: uri, NODE_ENV: 'development' } });
  const files = () => mongoose.connection.db.collection('images.files').countDocuments();

  before(async () => {
    const url = new URL(mongoUri);
    url.pathname = `/vr_test_seed_${Date.now()}`;
    uri = url.toString();
    await connectDB(uri);
    await User.create({ name: 'Seed Admin', email: 'seed-admin@example.com', passwordHash: 'x'.repeat(20), role: 'admin' });
  });
  after(async () => {
    await mongoose.connection.dropDatabase();
    await disconnectDB();
  });

  it('refuses to run without an admin account to attribute the products to', async () => {
    await User.deleteMany({});
    await assert.rejects(seed(), /create-admin/);
    await User.create({ name: 'Seed Admin', email: 'seed-admin@example.com', passwordHash: 'x'.repeat(20), role: 'admin' });
  });

  it('creates six clearly-marked demo products with GridFS images, stock history and varied stock', async () => {
    await seed();
    const products = await Product.find({ sku: /^DEMO-/ }).sort({ sku: 1 });
    assert.equal(products.length, 6);
    for (const p of products) {
      assert.match(p.name, /\(DEMO\)$/);
      assert.match(p.description, /^DEMO DATA/);
      assert.equal(p.status, 'published');
      assert.equal(p.images.length, 2);
      assert.equal(p.images.filter((i) => i.isPrimary).length, 1);
      assert.ok(p.price > 0 && p.mrp >= p.price);
    }
    assert.equal(products.filter((p) => p.isFeatured).length, 3);
    assert.equal(products.filter((p) => p.stockStatus === 'low').length, 1);
    assert.equal(products.filter((p) => p.stockStatus === 'out').length, 1);
    assert.equal(await files(), 24, '6 products x 2 images x (image + thumbnail)');
    assert.equal(await InventoryLog.countDocuments({ type: 'initial' }), 5, 'opening stock logged (not for the 0-stock product)');
  });

  it('is idempotent', async () => {
    const { stdout } = await seed();
    assert.match(stdout, /skip/);
    assert.equal(await Product.countDocuments({ sku: /^DEMO-/ }), 6);
    assert.equal(await files(), 24);
  });

  it('removes all demo products, their images and the demo category', async () => {
    await seed('--remove');
    assert.equal(await Product.countDocuments({ sku: /^DEMO-/ }), 0);
    assert.equal(await files(), 0);
    assert.equal(await mongoose.connection.db.collection('categories').countDocuments({ name: 'Demo Water Purifiers' }), 0);
  });

  it('refuses to run in production', async () => {
    await assert.rejects(
      run(process.execPath, [script], { env: { ...process.env, MONGODB_URI: uri, NODE_ENV: 'production', JWT_ACCESS_SECRET: 'a'.repeat(40), JWT_REFRESH_SECRET: 'b'.repeat(40) } }),
      /production/,
    );
  });
});
