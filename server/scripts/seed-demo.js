/**
 * Loads (or removes) clearly-labelled DEMO purifier products so the storefront and admin can be previewed.
 *
 *   npm run seed:demo                 add the demo products (safe to re-run; existing ones are skipped)
 *   npm run seed:demo -- --remove     delete every demo product, its images and the demo category
 *
 * Demo data is NOT VR Water Solutions inventory: names carry "(DEMO)", SKUs start with "DEMO-", and the
 * descriptions say so. Prices and stock are invented purely for layout. Everything is editable or
 * deletable in the admin dashboard. Refuses to run when NODE_ENV=production.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { ROLES } from '../src/constants/roles.js';
import { Category } from '../src/models/Category.js';
import { Product } from '../src/models/Product.js';
import { User } from '../src/models/User.js';
import { createCategory } from '../src/services/category.service.js';
import { addImages, createProduct, deleteProduct, updateProduct } from '../src/services/product.service.js';

const imageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../seed/demo-images');
const DEMO_CATEGORY = 'Demo Water Purifiers';
const DEMO_NOTE = 'DEMO DATA: sample listing used only to preview the layout. It is not a real VR Water Solutions product, price or specification.';

// Prices and stock are invented for layout only. Stock values are varied on purpose so the
// low-stock and out-of-stock alerts can be seen.
const demoProducts = [
  { key: 'domestic', sku: 'DEMO-DOM-001', name: 'Domestic Water Purifier (DEMO)', price: 8999, mrp: 10999, stock: 25, featured: true },
  { key: 'ro', sku: 'DEMO-RO-002', name: 'RO Water Purifier (DEMO)', price: 14999, mrp: 17999, stock: 12, featured: true },
  { key: 'uv', sku: 'DEMO-UV-003', name: 'UV Water Purifier (DEMO)', price: 11999, mrp: 13999, stock: 8, featured: false },
  { key: 'commercial', sku: 'DEMO-COM-004', name: 'Commercial Water Purifier (DEMO)', price: 74999, mrp: 84999, stock: 4, featured: false },
  { key: 'compact', sku: 'DEMO-CMP-005', name: 'Compact Water Purifier (DEMO)', price: 6499, mrp: 7999, stock: 18, featured: false },
  { key: 'premium', sku: 'DEMO-PRM-006', name: 'Premium Water Purifier (DEMO)', price: 24999, mrp: 29999, stock: 0, featured: true },
];

const label = (key) => key.charAt(0).toUpperCase() + key.slice(1);

async function findOrCreateCategory() {
  const existing = await Category.findOne({ name: DEMO_CATEGORY }).collation({ locale: 'en', strength: 2 });
  return existing ?? createCategory({ name: DEMO_CATEGORY, description: DEMO_NOTE });
}

async function add(admin) {
  const category = await findOrCreateCategory();
  for (const demo of demoProducts) {
    if (await Product.exists({ sku: demo.sku })) {
      console.log(`skip   ${demo.sku} (already exists)`);
      continue;
    }
    const created = await createProduct(
      {
        name: demo.name,
        sku: demo.sku,
        category: String(category._id),
        shortDescription: 'Demo product for layout preview only.',
        description: DEMO_NOTE,
        price: demo.price,
        mrp: demo.mrp,
        stock: demo.stock,
        lowStockThreshold: 5,
        features: ['Sample feature text for layout preview'],
        specifications: [
          { group: 'Demo information', items: [{ label: 'Data status', value: 'Sample data, not a real specification' }, { label: 'Type (label only)', value: label(demo.key) }] },
        ],
      },
      admin,
    );

    const files = await Promise.all(
      [1, 2].map(async (n) => ({ originalname: `${demo.key}-${n}.jpg`, buffer: await fs.readFile(path.join(imageDir, `${demo.key}-${n}.jpg`)) })),
    );
    await addImages(created._id, files);
    await updateProduct(created._id, { status: 'published', isFeatured: demo.featured }, admin);
    console.log(`added  ${demo.sku}  ${demo.name}`);
  }
}

async function remove() {
  const demos = await Product.find({ sku: /^DEMO-/ });
  for (const product of demos) {
    await deleteProduct(product._id);
    console.log(`removed ${product.sku}`);
  }
  const category = await Category.findOne({ name: DEMO_CATEGORY });
  if (category && !(await Product.exists({ category: category._id }))) {
    await category.deleteOne();
    console.log(`removed category "${DEMO_CATEGORY}"`);
  }
}

async function main() {
  if (env.isProduction) throw new Error('Refusing to load demo data when NODE_ENV=production.');
  const { values } = parseArgs({ options: { remove: { type: 'boolean', default: false } } });

  await connectDB();

  if (values.remove) return remove();

  const admin = await User.findOne({ role: ROLES.ADMIN });
  if (!admin) throw new Error('Create the first admin first: npm run create-admin');
  await add(admin);
  console.log('\nDemo data loaded. Remove it any time with: npm run seed:demo -- --remove');
}

main()
  .catch((error) => {
    console.error(`\nSeeding failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
