import assert from 'node:assert/strict';
import { after, before, describe, it, mock } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import { InventoryLog } from '../src/models/InventoryLog.js';
import { Product } from '../src/models/Product.js';
import { adminSession, setupDb, skipReason, teardownDb } from './helpers/db.js';

describe('inventory', { skip: skipReason }, () => {
  let app;
  let admin;
  let category;
  const api = (method, path) => request(app)[method](`/api/v1/admin${path}`).set(admin.auth);
  const newProduct = async (body = {}) =>
    (await api('post', '/products').send({ name: 'Stocked', price: 10, category, ...body })).body.product;
  const adjust = (id, body) => api('post', `/inventory/${id}/adjust`).send({ reason: 'correction', ...body });

  before(async () => {
    app = await setupDb();
    admin = await adminSession(app);
    category = (await api('post', '/categories').send({ name: 'Inventory' })).body.category._id;
  });
  after(teardownDb);

  it('logs initial stock when a product is created with stock', async () => {
    const p = await newProduct({ stock: 12 });
    const logs = await api('get', `/inventory/logs?product=${p._id}`);
    assert.equal(logs.body.items.length, 1);
    assert.deepEqual([logs.body.items[0].type, logs.body.items[0].delta, logs.body.items[0].balanceAfter], ['initial', 12, 12]);
  });

  it('adds, removes and sets stock, recording who did what', async () => {
    const p = await newProduct({ stock: 10 });

    const add = await adjust(p._id, { type: 'add', quantity: 5, reason: 'restock', note: 'PO-1' });
    assert.equal(add.status, 200);
    assert.equal(add.body.stock, 15);

    assert.equal((await adjust(p._id, { type: 'remove', quantity: 3, reason: 'damage' })).body.stock, 12);
    const set = await adjust(p._id, { type: 'set', quantity: 40 });
    assert.equal(set.body.stock, 40);
    assert.equal(set.body.log.delta, 28);

    const logs = (await api('get', `/inventory/logs?product=${p._id}`)).body.items;
    assert.deepEqual(logs.map((l) => [l.type, l.delta, l.balanceAfter]), [
      ['set', 28, 40], ['remove', -3, 12], ['add', 5, 15], ['initial', 10, 10],
    ]);
    assert.equal(logs[2].note, 'PO-1');
    assert.equal(logs[0].performedBy.name, admin.user.name);
    assert.equal((await Product.findById(p._id)).stock, 40);
  });

  it('prevents invalid stock values', async () => {
    const p = await newProduct({ stock: 3 });
    assert.equal((await adjust(p._id, { type: 'remove', quantity: 4 })).status, 409, 'cannot go negative');
    assert.equal((await adjust(p._id, { type: 'remove', quantity: 0 })).status, 400, 'zero change');
    assert.equal((await adjust(p._id, { type: 'add', quantity: -2 })).status, 400);
    assert.equal((await adjust(p._id, { type: 'add', quantity: 1.5 })).status, 400);
    assert.equal((await adjust(p._id, { type: 'set', quantity: -1 })).status, 400);
    assert.equal((await adjust(p._id, { type: 'add', quantity: '5' })).status, 400, 'no numeric strings');
    assert.equal((await adjust(p._id, { type: 'set', quantity: 1_000_001 })).status, 400);
    assert.equal((await adjust(p._id, { type: 'add', quantity: 1_000_000 })).status, 409, 'would exceed the maximum');
    assert.equal((await adjust(p._id, { type: 'add', quantity: 1, reason: 'sale' })).status, 400, 'sale is not a manual reason');
    assert.equal((await adjust('5f0000000000000000000000', { type: 'add', quantity: 1 })).status, 404);
    assert.equal((await Product.findById(p._id)).stock, 3, 'stock untouched by rejected requests');
    assert.equal((await api('get', `/inventory/logs?product=${p._id}`)).body.items.length, 1, 'no log for rejected requests');
  });

  it('allows setting stock to zero', async () => {
    const p = await newProduct({ stock: 3 });
    assert.equal((await adjust(p._id, { type: 'set', quantity: 0 })).body.stock, 0);
  });

  it('never oversells under concurrent removals', async () => {
    const p = await newProduct({ stock: 5 });
    const results = await Promise.all(Array.from({ length: 12 }, () => adjust(p._id, { type: 'remove', quantity: 1 })));
    assert.equal(results.filter((r) => r.status === 200).length, 5);
    assert.equal(results.filter((r) => r.status === 409).length, 7);
    assert.equal((await Product.findById(p._id)).stock, 0);
  });

  it('flags low and out-of-stock products using each product threshold', async () => {
    const cat = (await api('post', '/categories').send({ name: 'Alerts' })).body.category._id;
    const mk = (name, stock, lowStockThreshold) => newProduct({ name, category: cat, stock, lowStockThreshold });
    const healthy = await mk('Healthy', 50, 5);
    const low = await mk('Low', 4, 5);
    const edge = await mk('Edge', 5, 5);
    const out = await mk('Out', 0, 5);
    const custom = await mk('Custom Threshold', 30, 40);

    const names = async (stock) =>
      (await api('get', `/products?category=${cat}&stock=${stock}`)).body.items.map((i) => i.name).sort();
    assert.deepEqual(await names('low'), ['Custom Threshold', 'Edge', 'Low']);
    assert.deepEqual(await names('out'), ['Out']);
    assert.deepEqual(await names('in'), ['Healthy']);

    const list = (await api('get', `/products?category=${cat}&limit=50`)).body.items;
    const status = (p) => list.find((i) => i._id === p._id).stockStatus;
    assert.deepEqual([healthy, low, edge, out, custom].map(status), ['in', 'low', 'low', 'out', 'low']);
  });

  it('summarises products and alerts, excluding archived products from alerts', async () => {
    const before = (await api('get', '/dashboard/summary')).body;
    const p = await newProduct({ name: 'Summary Low', stock: 1, lowStockThreshold: 5 });
    let after = (await api('get', '/dashboard/summary')).body;
    assert.equal(after.inventory.low, before.inventory.low + 1);
    assert.equal(after.products.total, before.products.total + 1);

    await api('patch', `/products/${p._id}`).send({ status: 'archived' });
    after = (await api('get', '/dashboard/summary')).body;
    assert.equal(after.inventory.low, before.inventory.low);
    assert.equal(after.products.archived, before.products.archived + 1);
  });

  it('keeps history after the product is deleted', async () => {
    const p = await newProduct({ name: 'Ephemeral', stock: 2 });
    await api('delete', `/products/${p._id}`);
    const logs = (await api('get', `/inventory/logs?product=${p._id}`)).body.items;
    assert.equal(logs.length, 1);
    assert.equal(logs[0].productName, 'Ephemeral');
  });
  describe('stock and history stay consistent (no transactions)', () => {
    it('reverses the stock change when writing the history entry fails', async () => {
      const p = await newProduct({ name: 'Rollback', stock: 10 });
      const logsBefore = await InventoryLog.countDocuments({ product: p._id });
      const failing = mock.method(InventoryLog, 'create', async () => { throw new Error('simulated log write failure'); });
      try {
        const res = await adjust(p._id, { type: 'remove', quantity: 4 });
        assert.equal(res.status, 500);
      } finally {
        failing.mock.restore();
      }
      assert.equal((await Product.findById(p._id)).stock, 10, 'stock change was reversed');
      assert.equal(await InventoryLog.countDocuments({ product: p._id }), logsBefore);
      // and the system still works afterwards
      assert.equal((await adjust(p._id, { type: 'remove', quantity: 4 })).body.stock, 6);
    });

    it('removes the product again when the opening-stock log fails', async () => {
      const failing = mock.method(InventoryLog, 'create', async () => { throw new Error('simulated log write failure'); });
      try {
        const res = await api('post', '/products').send({ name: 'Never Saved', price: 5, category, stock: 7, sku: 'NEVER-SAVED-1' });
        assert.equal(res.status, 500);
      } finally {
        failing.mock.restore();
      }
      assert.equal(await Product.countDocuments({ sku: 'NEVER-SAVED-1' }), 0);
    });

    it('commits stock and its log entry together', async () => {
      const p = await newProduct({ name: 'Atomic', stock: 5 });
      await adjust(p._id, { type: 'add', quantity: 2, reason: 'restock' });
      const log = await InventoryLog.findOne({ product: p._id, type: 'add' });
      assert.equal(log.balanceAfter, (await Product.findById(p._id)).stock);
    });

  });
});
