import { describe, expect, it } from 'vitest';
import { validateProduct } from './ProductFormPage.jsx';
import { newStockPreview } from './InventoryPage.jsx';

const valid = { name: 'Purifier', sku: '', category: 'c1', brand: '', shortDescription: '', description: '', price: '1999.50', mrp: '', stock: '0', lowStockThreshold: '5', status: 'draft', isFeatured: false, features: [], specs: [] };

describe('validateProduct', () => {
  it('accepts a minimal valid product', () => {
    expect(validateProduct(valid, { isNew: true })).toEqual({});
  });

  it('flags missing name, category and price', () => {
    const errors = validateProduct({ ...valid, name: ' ', category: '', price: '' }, { isNew: true });
    expect(Object.keys(errors).sort()).toEqual(['category', 'name', 'price']);
  });

  it('rejects negative, non-numeric and 3-decimal prices', () => {
    for (const price of ['-1', 'abc', '10.999']) {
      expect(validateProduct({ ...valid, price }, { isNew: true }).price).toBeTruthy();
    }
  });

  it('requires MRP to be at least the selling price', () => {
    expect(validateProduct({ ...valid, price: '500', mrp: '400' }, { isNew: true }).mrp).toMatch(/lower than the selling price/);
    expect(validateProduct({ ...valid, price: '500', mrp: '500' }, { isNew: true }).mrp).toBeUndefined();
  });

  it('validates SKU format only when one is typed', () => {
    expect(validateProduct({ ...valid, sku: 'bad sku!' }, { isNew: true }).sku).toBeTruthy();
    expect(validateProduct({ ...valid, sku: 'vr-123' }, { isNew: true }).sku).toBeUndefined();
  });

  it('requires whole-number stock values', () => {
    expect(validateProduct({ ...valid, stock: '1.5' }, { isNew: true }).stock).toBeTruthy();
    expect(validateProduct({ ...valid, stock: '-3' }, { isNew: true }).stock).toBeTruthy();
    expect(validateProduct({ ...valid, stock: 'abc' }, { isNew: false }).stock).toBeUndefined(); // stock is not edited here
    expect(validateProduct({ ...valid, lowStockThreshold: 'x' }, { isNew: true }).lowStockThreshold).toBeTruthy();
  });

  it('checks specification rows but ignores fully blank ones', () => {
    const specs = [{ key: 'g', group: '', items: [
      { key: 'a', label: '', value: '' },
      { key: 'b', label: 'Capacity', value: '' },
      { key: 'c', label: 'capacity', value: '7 L' },
      { key: 'd', label: '', value: 'orphan' },
    ] }];
    const errors = validateProduct({ ...valid, specs }, { isNew: true });
    expect(errors['specifications.0.items.0.label']).toBeUndefined();
    expect(errors['specifications.0.items.1.value']).toBeTruthy();
    expect(errors['specifications.0.items.2.label']).toMatch(/already used/);
    expect(errors['specifications.0.items.3.label']).toBeTruthy();
  });
});

describe('newStockPreview', () => {
  it('previews add, remove and set, and ignores unusable input', () => {
    expect(newStockPreview('add', 10, '5')).toBe(15);
    expect(newStockPreview('remove', 10, '3')).toBe(7);
    expect(newStockPreview('remove', 10, '12')).toBe(-2);
    expect(newStockPreview('set', 10, '0')).toBe(0);
    expect(newStockPreview('add', 10, '')).toBeNull();
    expect(newStockPreview('add', 10, '1.5')).toBeNull();
  });
});
