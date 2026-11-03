import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { Product } from '../src/models/Product.js';
import { adminSession, setupDb, skipReason, teardownDb } from './helpers/db.js';

describe('categories, brands and products', { skip: skipReason }, () => {
  let app;
  let admin;
  const api = (method, path) => request(app)[method](`/api/v1/admin${path}`).set(admin.auth);

  const newCategory = async (name) => (await api('post', '/categories').send({ name })).body.category;
  const newProduct = async (overrides = {}) => {
    const category = overrides.category ?? (await newCategory(`Cat ${Math.random().toString(36).slice(2, 8)}`))._id;
    const res = await api('post', '/products').send({ name: 'Test Purifier', price: 1000, category, ...overrides });
    return res;
  };

  before(async () => {
    app = await setupDb();
    admin = await adminSession(app);
  });
  after(teardownDb);

  describe('categories', () => {
    it('creates, edits and lists categories with a generated unique slug', async () => {
      const a = await api('post', '/categories').send({ name: 'Water Purifiers', description: 'd' });
      assert.equal(a.status, 201);
      assert.equal(a.body.category.slug, 'water-purifiers');
      const b = await api('post', '/categories').send({ name: 'Water  Purifiers!' });
      assert.equal(b.status, 201);
      assert.equal(b.body.category.slug, 'water-purifiers-2');

      const edit = await api('patch', `/categories/${a.body.category._id}`).send({ isActive: false, sortOrder: 3 });
      assert.equal(edit.body.category.isActive, false);
      assert.equal(edit.body.category.slug, 'water-purifiers', 'slug stays stable on edit');

      const list = await api('get', '/categories?active=false');
      assert.ok(list.body.items.some((c) => c.name === 'Water Purifiers'));
    });

    it('rejects duplicate names case-insensitively', async () => {
      await api('post', '/categories').send({ name: 'Unique Name' });
      const dup = await api('post', '/categories').send({ name: 'unique name' });
      assert.equal(dup.status, 409);
    });

    it('validates input and rejects unknown fields', async () => {
      assert.equal((await api('post', '/categories').send({ name: 'x' })).status, 400);
      assert.equal((await api('post', '/categories').send({ name: 'Valid Name', slug: 'hacked' })).status, 400);
    });

    it('supports one level of nesting only and prevents cycles', async () => {
      const parent = await newCategory('Parent Cat');
      const child = (await api('post', '/categories').send({ name: 'Child Cat', parent: parent._id })).body.category;
      assert.equal(child.parent, parent._id);
      assert.equal((await api('post', '/categories').send({ name: 'Grandchild', parent: child._id })).status, 400);
      assert.equal((await api('patch', `/categories/${parent._id}`).send({ parent: parent._id })).status, 400);
      assert.equal((await api('patch', `/categories/${parent._id}`).send({ parent: child._id })).status, 400);
    });

    it('refuses to delete a category that has products or sub-categories', async () => {
      const category = await newCategory('Has Products');
      await newProduct({ category: category._id });
      const blocked = await api('delete', `/categories/${category._id}`);
      assert.equal(blocked.status, 409);
      assert.match(blocked.body.message, /1 product/);

      const empty = await newCategory('Empty Cat');
      assert.equal((await api('delete', `/categories/${empty._id}`)).status, 200);
      assert.equal((await api('get', `/categories/${empty._id}`)).status, 404);
    });

    it('returns product counts per category', async () => {
      const category = await newCategory('Counted');
      await newProduct({ category: category._id, name: 'P1' });
      await newProduct({ category: category._id, name: 'P2' });
      const list = await api('get', '/categories?q=Counted');
      assert.equal(list.body.items[0].productCount, 2);
    });
  });

  describe('brands', () => {
    it('creates, edits, deactivates and lists brands', async () => {
      const created = await api('post', '/brands').send({ name: 'Acme Brand' });
      assert.equal(created.status, 201);
      const id = created.body.brand._id;
      assert.equal((await api('patch', `/brands/${id}`).send({ isActive: false, description: 'x' })).body.brand.isActive, false);
      assert.equal((await api('post', '/brands').send({ name: 'ACME brand' })).status, 409);
      assert.equal((await api('get', '/brands?active=false&q=acme')).body.items.length, 1);
    });
  });

  describe('products', () => {
    it('creates a product with generated SKU and slug, and defaults to draft', async () => {
      const res = await newProduct({ name: 'Alpha One', price: 1999.5, mrp: 2500 });
      assert.equal(res.status, 201);
      const p = res.body.product;
      assert.match(p.sku, /^VR-[0-9A-F]{6}$/);
      assert.equal(p.slug, 'alpha-one');
      assert.equal(p.status, 'draft');
      assert.equal(p.isFeatured, false);
      assert.equal(p.stock, 0);
      assert.equal(p.createdBy, admin.user.id);
    });

    it('accepts a custom SKU (normalised) and rejects duplicates and bad formats', async () => {
      const ok = await newProduct({ sku: ' vr-custom-01 ' });
      assert.equal(ok.body.product.sku, 'VR-CUSTOM-01');
      assert.equal((await newProduct({ sku: 'VR-CUSTOM-01' })).status, 409);
      assert.equal((await newProduct({ sku: 'bad sku!' })).status, 400);
    });

    it('validates prices server-side', async () => {
      assert.equal((await newProduct({ price: -1 })).status, 400);
      assert.equal((await newProduct({ price: 10.999 })).status, 400);
      assert.equal((await newProduct({ price: '100' })).status, 400, 'numbers only, no strings');
      const lowMrp = await newProduct({ price: 500, mrp: 400 });
      assert.equal(lowMrp.status, 400);
      assert.equal(lowMrp.body.details[0].path, 'body.mrp');
    });

    it('never accepts client-supplied roles, ownership, slug, images or stock changes', async () => {
      const category = (await newCategory('Mass Assign'))._id;
      for (const extra of [{ role: 'admin' }, { createdBy: admin.user.id }, { slug: 'x' }, { images: [] }, { isAdmin: true }]) {
        assert.equal((await api('post', '/products').send({ name: 'Hack', price: 1, category, ...extra })).status, 400);
      }
      const p = (await newProduct({ stock: 5 })).body.product;
      assert.equal((await api('patch', `/products/${p._id}`).send({ stock: 999 })).status, 400, 'stock only via inventory');
    });

    it('requires an existing category and brand', async () => {
      const missing = '5f0000000000000000000000';
      assert.equal((await newProduct({ category: missing })).status, 400);
      const category = (await newCategory('Brand Check'))._id;
      assert.equal((await newProduct({ category, brand: missing })).status, 400);
    });

    it('edits a product without touching fields that were not sent', async () => {
      const p = (await newProduct({ name: 'Editable', price: 100, shortDescription: 'keep me', features: ['a'] })).body.product;
      const edit = await api('patch', `/products/${p._id}`).send({ price: 150 });
      assert.equal(edit.status, 200);
      assert.equal(edit.body.product.price, 150);
      assert.equal(edit.body.product.shortDescription, 'keep me');
      assert.deepEqual(edit.body.product.features, ['a']);
      assert.equal(edit.body.product.status, 'draft');
    });

    it('cannot publish a product that has no image', async () => {
      const p = (await newProduct()).body.product;
      const res = await api('patch', `/products/${p._id}`).send({ status: 'published' });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /image/);
      assert.equal((await newProduct({ status: 'published' })).status, 400);
    });

    it('archives and restores through status, and toggles featured', async () => {
      const p = (await newProduct()).body.product;
      assert.equal((await api('patch', `/products/${p._id}`).send({ status: 'archived' })).body.product.status, 'archived');
      assert.equal((await api('patch', `/products/${p._id}`).send({ status: 'draft' })).body.product.status, 'draft');
      assert.equal((await api('patch', `/products/${p._id}`).send({ isFeatured: true })).body.product.isFeatured, true);
      assert.equal((await api('get', '/products?featured=true')).body.items.some((i) => i._id === p._id), true);
      assert.equal((await api('patch', `/products/${p._id}`).send({ isFeatured: false })).body.product.isFeatured, false);
    });

    it('stores fully custom, admin-defined specifications', async () => {
      const specs = [
        { group: 'Technology', items: [{ label: 'Purification stages', value: '7' }, { label: 'Filter type', value: 'Custom' }] },
        { group: '', items: [{ label: 'Anything the admin wants', value: 'Any value' }] },
      ];
      const p = (await newProduct({ specifications: specs })).body.product;
      assert.deepEqual(p.specifications, specs);
      const dup = await newProduct({ specifications: [{ group: 'G', items: [{ label: 'A', value: '1' }, { label: 'a', value: '2' }] }] });
      assert.equal(dup.status, 400);
      const empty = await newProduct({ specifications: [{ group: 'G', items: [] }] });
      assert.equal(empty.status, 400);
    });

    it('paginates, searches, filters and sorts', async () => {
      const category = (await newCategory('Listing Cat'))._id;
      for (let i = 1; i <= 5; i += 1) {
        await newProduct({ category, name: `Listing Item ${i}`, price: i * 100, sku: `LST-${i}00`, stock: i === 5 ? 0 : 20 });
      }
      const page1 = await api('get', `/products?category=${category}&limit=2&page=1&sort=price_asc`);
      assert.equal(page1.body.items.length, 2);
      assert.deepEqual(page1.body.pagination, { page: 1, limit: 2, total: 5, totalPages: 3 });
      assert.deepEqual(page1.body.items.map((i) => i.price), [100, 200]);

      const page3 = await api('get', `/products?category=${category}&limit=2&page=3&sort=price_asc`);
      assert.equal(page3.body.items.length, 1);

      assert.equal((await api('get', '/products?q=LST-300')).body.items.length, 1, 'search by SKU');
      assert.equal((await api('get', '/products?q=listing item 2')).body.items.length, 1, 'case-insensitive name search');
      assert.equal((await api('get', `/products?category=${category}&stock=out`)).body.items.length, 1);
      assert.equal((await api('get', `/products?category=${category}&status=published`)).body.items.length, 0);
      assert.equal((await api('get', '/products?limit=500')).status, 400, 'limit is capped');
      assert.equal((await api('get', '/products?q=.*(a+)+$')).status, 200, 'regex metacharacters are escaped');
    });

    it('list responses include category/brand names but not heavy fields', async () => {
      const category = (await newCategory('Populated'))._id;
      await newProduct({ category, description: 'long text', name: 'Populated Item' });
      const item = (await api('get', '/products?q=Populated Item')).body.items[0];
      assert.equal(item.category.name, 'Populated');
      assert.equal(item.description, undefined);
    });

    it('deletes permanently and returns 404 afterwards', async () => {
      const p = (await newProduct()).body.product;
      assert.equal((await api('delete', `/products/${p._id}`)).status, 200);
      assert.equal((await api('get', `/products/${p._id}`)).status, 404);
      assert.equal(await Product.countDocuments({ _id: p._id }), 0);
    });

    it('returns 400 for malformed ids and 404 for unknown ones', async () => {
      assert.equal((await api('get', '/products/not-an-id')).status, 400);
      assert.equal((await api('get', '/products/5f0000000000000000000000')).status, 404);
    });
  });
});
