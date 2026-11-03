import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectImageType } from '../src/utils/imageSniff.js';
import { escapeRegex } from '../src/utils/query.js';
import { slugify } from '../src/utils/slug.js';
import { adjustStockBody } from '../src/validators/inventory.validators.js';
import { productCreateBody, productUpdateBody, sku } from '../src/validators/product.validators.js';

const base = { name: 'Purifier', price: 100, category: '5f0000000000000000000000' };

describe('product validators', () => {
  it('normalises and validates SKUs', () => {
    assert.equal(sku.parse(' vr-ab12 '), 'VR-AB12');
    for (const bad of ['', 'A', '-AB', 'AB-', 'has space', 'a'.repeat(41)]) assert.equal(sku.safeParse(bad).success, false, bad);
  });

  it('treats an empty SKU as "generate for me"', () => {
    assert.equal(productCreateBody.parse({ ...base, sku: '' }).sku, undefined);
  });

  it('does not inject defaults on partial updates', () => {
    assert.deepEqual(productUpdateBody.parse({ price: 5 }), { price: 5 });
  });

  it('rejects unknown keys on create and update', () => {
    assert.equal(productCreateBody.safeParse({ ...base, role: 'admin' }).success, false);
    assert.equal(productUpdateBody.safeParse({ stock: 1 }).success, false);
  });

  it('checks MRP against price on create and update', () => {
    assert.equal(productCreateBody.safeParse({ ...base, mrp: 99 }).success, false);
    assert.equal(productCreateBody.safeParse({ ...base, mrp: 100 }).success, true);
    assert.equal(productUpdateBody.safeParse({ price: 50, mrp: 40 }).success, false);
    assert.equal(productUpdateBody.safeParse({ mrp: null }).success, true);
  });

  it('limits specification size', () => {
    const items = Array.from({ length: 51 }, (_, i) => ({ label: `L${i}`, value: 'v' }));
    assert.equal(productCreateBody.safeParse({ ...base, specifications: [{ group: 'G', items }] }).success, false);
  });
});

describe('inventory validator', () => {
  it('requires a positive quantity for add/remove but allows zero for set', () => {
    const ok = { reason: 'correction' };
    assert.equal(adjustStockBody.safeParse({ ...ok, type: 'add', quantity: 0 }).success, false);
    assert.equal(adjustStockBody.safeParse({ ...ok, type: 'set', quantity: 0 }).success, true);
  });
});

describe('utilities', () => {
  it('detects image types from magic bytes and rejects everything else', () => {
    assert.equal(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(20).fill(0)])), 'image/jpeg');
    assert.equal(detectImageType(Buffer.from('GIF89a000000000000')), null);
    assert.equal(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
    assert.equal(detectImageType(Buffer.alloc(3)), null);
  });

  it('slugifies text, including accents and symbols', () => {
    assert.equal(slugify('  Água Purifier -- 7L!! '), 'agua-purifier-7l');
    assert.equal(slugify('!!!'), 'item');
  });

  it('escapes regex metacharacters', () => {
    assert.equal(new RegExp(escapeRegex('a.b*(c)')).test('a.b*(c)'), true);
    assert.equal(new RegExp(escapeRegex('a.b')).test('axb'), false);
  });
});
