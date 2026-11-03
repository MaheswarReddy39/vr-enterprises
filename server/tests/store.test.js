import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import { Brand } from '../src/models/Brand.js';
import { Category } from '../src/models/Category.js';
import { Enquiry } from '../src/models/Enquiry.js';
import { Product } from '../src/models/Product.js';
import { adminSession, createUser, login, setupDb, skipReason, teardownDb } from './helpers/db.js';

describe('public storefront API', { skip: skipReason }, () => {
  let app;
  let cats;
  const get = (path) => request(app).get(`/api/v1/store${path}`);
  const oid = () => new mongoose.Types.ObjectId();
  const image = (primary = false) => ({ fileId: oid(), thumbFileId: oid(), width: 800, height: 800, size: 1000, isPrimary: primary });

  let n = 0;
  const make = (overrides = {}) => {
    n += 1;
    return Product.create({
      name: `Product ${n}`,
      slug: `product-${n}`,
      sku: `SKU-${String(n).padStart(3, '0')}`,
      category: cats.water._id,
      price: 1000 + n * 100,
      stock: 20,
      status: 'published',
      images: [image(true), image()],
      ...overrides,
    });
  };

  before(async () => {
    app = await setupDb();
    const [water, air, hidden, child] = await Category.create([
      { name: 'Water', slug: 'water' },
      { name: 'Air', slug: 'air' },
      { name: 'Hidden', slug: 'hidden', isActive: false },
      { name: 'Water Sub', slug: 'water-sub', isActive: true },
    ]);
    child.parent = water._id;
    await child.save();
    cats = { water, air, hidden, child };
  });
  after(teardownDb);

  describe('visibility', () => {
    it('lists only published products in active categories', async () => {
      await make({ name: 'Visible One', slug: 'visible-one' });
      await make({ name: 'Draft One', slug: 'draft-one', status: 'draft' });
      await make({ name: 'Archived One', slug: 'archived-one', status: 'archived' });
      await make({ name: 'In Hidden Category', slug: 'in-hidden', category: cats.hidden._id });

      const names = (await get('/products?limit=48')).body.items.map((i) => i.name);
      assert.ok(names.includes('Visible One'));
      for (const hidden of ['Draft One', 'Archived One', 'In Hidden Category']) assert.ok(!names.includes(hidden), hidden);
    });

    it('returns 404 for unpublished, archived and hidden-category products, by slug and by id', async () => {
      const draft = await make({ slug: 'secret-draft', status: 'draft' });
      const archived = await make({ slug: 'secret-archived', status: 'archived' });
      const inHidden = await make({ slug: 'secret-hidden', category: cats.hidden._id });
      for (const p of [draft, archived, inHidden]) {
        assert.equal((await get(`/products/${p.slug}`)).status, 404);
        assert.equal((await get(`/products/${p._id}`)).status, 404);
        assert.equal((await get(`/products/${p.slug}/related`)).status, 404);
      }
      assert.equal((await get('/products/does-not-exist')).status, 404);
    });

    it('ignores attempts to request unpublished products through filters', async () => {
      const res = await get('/products?status=draft&limit=48');
      assert.equal(res.status, 200);
      assert.ok(res.body.items.every((i) => !/Draft|Archived/.test(i.name)));
    });

    it('never exposes admin-only fields', async () => {
      const brand = await Brand.create({ name: 'Brandy', slug: 'brandy' });
      const p = await make({ slug: 'field-check', brand: brand._id, createdBy: oid(), updatedBy: oid(), lowStockThreshold: 3, stock: 2 });
      const detail = (await get(`/products/${p.slug}`)).body.product;
      const list = (await get('/products?q=Product&limit=48')).body.items.find((i) => i.slug === 'field-check');
      for (const body of [detail, list]) {
        const text = JSON.stringify(body);
        for (const secret of ['createdBy', 'updatedBy', 'lowStockThreshold', '"stock"', 'status', 'fileId', 'thumbFileId', 'publicId', '__v', 'isPrimary']) {
          assert.ok(!text.includes(secret), `leaked ${secret}`);
        }
      }
      assert.equal(detail.brand.name, 'Brandy');
      assert.equal(detail.availability, 'low_stock');
      assert.equal(detail.maxQuantity, 2);
    });

    it('hides inactive brands', async () => {
      const brand = await Brand.create({ name: 'Dormant', slug: 'dormant', isActive: false });
      const p = await make({ slug: 'inactive-brand', brand: brand._id });
      assert.equal((await get(`/products/${p.slug}`)).body.product.brand, null);
    });

    it('is public (no token) and the admin API stays protected', async () => {
      assert.equal((await get('/products')).status, 200);
      assert.equal((await request(app).get('/api/v1/admin/products')).status, 401);
    });
  });

  describe('listing', () => {
    it('paginates with totals', async () => {
      for (let i = 0; i < 6; i += 1) await make();
      const page1 = await get('/products?limit=5&page=1');
      assert.equal(page1.body.items.length, 5);
      assert.equal(page1.body.pagination.limit, 5);
      assert.ok(page1.body.pagination.total > 5);
      const last = await get(`/products?limit=5&page=${page1.body.pagination.totalPages}`);
      assert.ok(last.body.items.length >= 1);
      assert.equal((await get('/products?limit=500')).status, 400);
      assert.equal((await get('/products?page=0')).status, 400);
    });

    it('sorts by price both ways, by name and by newest', async () => {
      const prices = async (sort) => (await get(`/products?sort=${sort}&limit=48`)).body.items.map((i) => i.price);
      const asc = await prices('price_asc');
      assert.deepEqual(asc, [...asc].sort((a, b) => a - b));
      const desc = await prices('price_desc');
      assert.deepEqual(desc, [...desc].sort((a, b) => b - a));
      const names = (await get('/products?sort=name&limit=48')).body.items.map((i) => i.name);
      assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
      assert.equal((await get('/products?sort=stock')).status, 400);
    });

    it('puts featured products first by default and filters featured', async () => {
      await make({ name: 'Featured Star', slug: 'featured-star', isFeatured: true });
      const first = (await get('/products?limit=48')).body.items[0];
      assert.equal(first.isFeatured, true);
      const featured = (await get('/products?featured=true&limit=48')).body.items;
      assert.ok(featured.length >= 1 && featured.every((i) => i.isFeatured));
    });

    it('searches name, description and SKU, case-insensitively, and escapes regex characters', async () => {
      await make({ name: 'Zephyr Special', slug: 'zephyr', sku: 'ZEPH-001', shortDescription: 'quirkywording here' });
      assert.equal((await get('/products?q=zephyr')).body.items.length, 1);
      assert.equal((await get('/products?q=QUIRKYWORDING')).body.items.length, 1);
      assert.equal((await get('/products?q=zeph-001')).body.items.length, 1);
      assert.equal((await get('/products?q=nothing-matches-this')).body.items.length, 0);
      assert.equal((await get('/products?q=.*(a+)+$')).status, 200);
      assert.equal((await get('/products?q=Zephyr.')).body.items.length, 0, '"." is literal, not a wildcard');
    });

    it('filters by category slug or id, including sub-categories, and ignores unknown/inactive categories', async () => {
      const inAir = await make({ name: 'Air Thing', slug: 'air-thing', category: cats.air._id });
      const inChild = await make({ name: 'Child Thing', slug: 'child-thing', category: cats.child._id });

      const air = await get('/products?category=air&limit=48');
      assert.deepEqual(air.body.items.map((i) => i.name), ['Air Thing']);
      assert.equal(air.body.category.name, 'Air');
      assert.equal((await get(`/products?category=${cats.air._id}`)).body.items.length, 1);

      const parent = (await get('/products?category=water&limit=48')).body.items.map((i) => i.name);
      assert.ok(parent.includes('Child Thing'), 'parent category includes its sub-categories');
      assert.ok(!parent.includes('Air Thing'));

      assert.equal((await get('/products?category=hidden')).body.items.length, 0);
      assert.equal((await get('/products?category=nope')).body.items.length, 0);
      assert.equal((await get('/products?category=bad_slug!')).status, 400);
      assert.ok(inAir && inChild);
    });

    it('reports availability, discount and demo labelling', async () => {
      await make({ name: 'Out Item', slug: 'out-item', stock: 0, price: 500, mrp: 1000, sku: 'DEMO-OUT-1' });
      const item = (await get('/products?q=Out Item')).body.items[0];
      assert.equal(item.availability, 'out_of_stock');
      assert.equal(item.maxQuantity, 0);
      assert.equal(item.discountPercent, 50);
      assert.equal(item.isDemo, true);
      const regular = (await get('/products?q=Featured Star')).body.items[0];
      assert.equal(regular.isDemo, false);
      assert.equal(regular.availability, 'in_stock');
      assert.equal(regular.maxQuantity, 10, 'capped at 10 per order');
    });

    it('ignores an MRP that is not higher than the price', async () => {
      const p = await make({ slug: 'no-discount', price: 900, mrp: 900 });
      const item = (await get(`/products/${p.slug}`)).body.product;
      assert.equal(item.mrp, null);
      assert.equal(item.discountPercent, null);
    });
  });

  describe('detail and related', () => {
    it('returns the full public product by slug and by id, with primary image first', async () => {
      const secondaryPrimary = [image(false), image(true), image(false)];
      const p = await make({ slug: 'detail-check', images: secondaryPrimary, description: 'Long text', features: ['A feature'], specifications: [{ group: 'G', items: [{ label: 'L', value: 'V' }] }] });
      const bySlug = (await get('/products/detail-check')).body.product;
      const byId = (await get(`/products/${p._id}`)).body.product;
      assert.deepEqual(bySlug, byId);
      assert.equal(bySlug.description, 'Long text');
      assert.deepEqual(bySlug.features, ['A feature']);
      assert.deepEqual(bySlug.specifications, [{ group: 'G', items: [{ label: 'L', value: 'V' }] }]);
      assert.equal(bySlug.images.length, 3);
      assert.equal(bySlug.images[0].id, bySlug.primaryImage.id);
      assert.match(bySlug.images[0].url, /^\/api\/v1\/media\/[a-f0-9]{24}$/);
      assert.equal(bySlug.images[0].id, String(p.images[1]._id), 'the primary image is listed first');
    });

    it('list items carry at most the two images needed for cards and no heavy fields', async () => {
      const item = (await get('/products?q=Detail Check')).body;
      const found = (await get('/products?limit=48')).body.items.find((i) => i.slug === 'detail-check');
      assert.ok(found.images.length <= 2);
      assert.equal(found.description, undefined);
      assert.equal(found.specifications, undefined);
      assert.ok(item);
    });

    it('returns related products excluding the product itself and unpublished ones', async () => {
      const p = await make({ slug: 'related-base' });
      await make({ slug: 'related-draft', status: 'draft', name: 'Related Draft' });
      const { items } = (await get(`/products/${p.slug}/related`)).body;
      assert.ok(items.length > 0 && items.length <= 4);
      assert.ok(items.every((i) => i.slug !== 'related-base' && i.name !== 'Related Draft'));
      assert.equal((await get(`/products/${p.slug}/related?limit=2`)).body.items.length, 2);
      assert.equal((await get(`/products/${p.slug}/related?limit=99`)).status, 400);
    });

    it('rejects malformed keys', async () => {
      assert.equal((await get('/products/bad key!')).status, 400);
    });
  });

  describe('categories', () => {
    it('returns only active categories that contain published products, with counts', async () => {
      const { items } = (await get('/categories')).body;
      const slugs = items.map((c) => c.slug);
      assert.ok(slugs.includes('water') && slugs.includes('air'));
      assert.ok(!slugs.includes('hidden'), 'inactive category hidden');
      const water = items.find((c) => c.slug === 'water');
      assert.ok(water.productCount > 0);
      assert.equal(items.find((c) => c.slug === 'water-sub').parent, 'water');
      assert.ok(items.every((c) => c.productCount > 0));
      assert.ok(!JSON.stringify(items).includes('"isActive"'));
    });

    it('drops a category from the list when it has no published products', async () => {
      await Category.create({ name: 'Empty Cat', slug: 'empty-cat' });
      assert.ok(!(await get('/categories')).body.items.some((c) => c.slug === 'empty-cat'));
    });
  });

  describe('enquiries', () => {
    const post = (body) => request(app).post('/api/v1/store/enquiries').send(body);
    const valid = { name: 'Asha Rao', email: 'Asha@Example.com', message: 'I would like to know more about this purifier.' };

    it('stores a valid enquiry (public, no token)', async () => {
      const res = await post({ ...valid, phone: '+91 98765 43210' });
      assert.equal(res.status, 201);
      const saved = await Enquiry.findOne({ email: 'asha@example.com' });
      assert.equal(saved.status, 'new');
      assert.equal(saved.phone, '+91 98765 43210');
    });

    it('links a published product and ignores unpublished/unknown ones', async () => {
      const published = await make({ slug: 'enquiry-product', name: 'Enquiry Product' });
      const draft = await make({ slug: 'enquiry-draft', status: 'draft' });
      await post({ ...valid, product: String(published._id) });
      await post({ ...valid, product: String(draft._id) });
      const linked = await Enquiry.find({ productName: 'Enquiry Product' });
      assert.equal(linked.length, 1);
      assert.equal(await Enquiry.countDocuments({ product: draft._id }), 0);
    });

    it('validates input and rejects unknown fields', async () => {
      assert.equal((await post({ ...valid, name: 'A' })).status, 400);
      assert.equal((await post({ ...valid, email: 'nope' })).status, 400);
      assert.equal((await post({ ...valid, message: 'short' })).status, 400);
      assert.equal((await post({ ...valid, phone: 'abc' })).status, 400);
      assert.equal((await post({ ...valid, status: 'resolved' })).status, 400);
      assert.equal((await post({ ...valid, message: 'x'.repeat(2001) })).status, 400);
    });

    it('silently drops honeypot (bot) submissions', async () => {
      const before = await Enquiry.countDocuments();
      const res = await post({ ...valid, website: 'http://spam.example' });
      assert.equal(res.status, 201);
      assert.equal(await Enquiry.countDocuments(), before);
    });

    it('is manageable by admins only', async () => {
      const admin = await adminSession(app);
      const list = await request(app).get('/api/v1/admin/enquiries').set(admin.auth);
      assert.equal(list.status, 200);
      assert.ok(list.body.items.length > 0);
      assert.ok(list.body.unread > 0);

      const id = list.body.items[0]._id;
      const patched = await request(app).patch(`/api/v1/admin/enquiries/${id}`).set(admin.auth).send({ status: 'read' });
      assert.equal(patched.body.enquiry.status, 'read');
      assert.equal((await request(app).patch(`/api/v1/admin/enquiries/${id}`).set(admin.auth).send({ status: 'bogus' })).status, 400);

      assert.equal((await request(app).get('/api/v1/admin/enquiries')).status, 401);
      const customer = await createUser({ role: 'customer' });
      const { token } = await login(app, customer.email);
      assert.equal((await request(app).get('/api/v1/admin/enquiries').set('Authorization', `Bearer ${token}`)).status, 403);

      const staff = await adminSession(app, 'staff');
      assert.equal((await request(app).delete(`/api/v1/admin/enquiries/${id}`).set(staff.auth)).status, 403);
      assert.equal((await request(app).delete(`/api/v1/admin/enquiries/${id}`).set(admin.auth)).status, 200);
    });
  });
});
