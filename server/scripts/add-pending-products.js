/**
 * Adds the four purifiers from the supplied photos as UNPUBLISHED DRAFTS, using ONLY what is printed on the units.
 * Web research found no manufacturer page or verified specification sheet for any of them (see
 * seed/products-pending/RESEARCH.md), so every other detail is "Not verified". Price and stock are left at 0.
 * Nothing is published: the owner approves the wording, enters price and stock, then publishes in the admin.
 * Safe to re-run: products that already exist are skipped. The photos are the ORIGINAL files, unmodified
 * (the image service only converts them to web formats).
 *
 *   node scripts/add-pending-products.js
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { ROLES } from '../src/constants/roles.js';
import { Category } from '../src/models/Category.js';
import { Product } from '../src/models/Product.js';
import { User } from '../src/models/User.js';
import { createCategory } from '../src/services/category.service.js';
import { addImages, createProduct } from '../src/services/product.service.js';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../seed/products-pending');
const NOT_VERIFIED = 'Not verified';
const NOTE = 'Only what is printed on the unit in the supplied photo is stated here. All other details are not verified yet and will be added once confirmed with the supplier.';

const unverified = [
  ['Storage capacity', NOT_VERIFIED], ['Purification stages', NOT_VERIFIED], ['Warranty', NOT_VERIFIED],
  ['Dimensions', NOT_VERIFIED], ['Power consumption', NOT_VERIFIED], ['Certifications', NOT_VERIFIED],
].map(([label, value]) => ({ label, value }));

const spec = (brand, model, technology, extra = []) => [
  { group: 'As printed on the unit', items: [{ label: 'Brand label', value: brand }, ...(model ? [{ label: 'Model label', value: model }] : []), { label: 'Technology label', value: technology }, ...extra] },
  { group: 'Not verified', items: unverified },
  { group: 'Information source', items: [{ label: 'Source', value: 'Labels on the supplied product photo. No manufacturer page or specification sheet was found online.' }] },
];

const products = [
  {
    name: 'AQUA Water Purifier (RO+UV+UF)',
    file: 'aqua-water-purifier.jpg',
    shortDescription: 'Purifier labelled RO + UV + UF. Other specifications are not verified yet.',
    features: ['Labelled RO + UV + UF'],
    specifications: spec('AQUA Water Purifier', null, 'RO + UV + UF'),
  },
  {
    name: 'Sapphire Vogue Signature PRO Series Water Purifier',
    file: 'sapphire-vogue-signature-pro.jpg',
    shortDescription: 'Black purifier labelled Sapphire Vogue, Signature PRO series, with RO, UV, UF and TDS indicators. Other specifications are not verified yet.',
    features: ['Panel marked RO, UV, UF and TDS', 'Indicators: Power, Purify, Tank full'],
    specifications: spec('Sapphire', 'Vogue, Signature PRO series', 'RO, UV, UF and TDS marked on the panel'),
  },
  {
    name: 'Pearl Copper Water Purifier (RO+UV+UF+TDS Control)',
    file: 'pearl-copper.jpg',
    shortDescription: 'Purifier labelled Pearl Copper, RO + UV + UF + TDS control, with a copper cartridge window. Other specifications are not verified yet.',
    features: ['Labelled RO + UV + UF + TDS control', 'Cartridge window marked COPPER', 'Indicators: Power, Purify, Tank'],
    specifications: spec('Pearl Copper', 'Pearl COPPER', 'RO + UV + UF + TDS control'),
  },
  {
    name: 'Purosis Elite Water Purifier (RO+UV+UF+TDS)',
    file: 'purosis-elite.jpg',
    shortDescription: 'White purifier labelled purosis, purifier Elite, RO + UV + UF + TDS. Other specifications are not verified yet.',
    features: ['Labelled RO + UV + UF + TDS'],
    specifications: spec('purosis', 'purifier Elite', 'RO + UV + UF + TDS'),
  },
];

async function main() {
  await connectDB();
  const admin = await User.findOne({ role: ROLES.ADMIN });
  if (!admin) throw new Error('Create the first admin first: npm run create-admin');
  const category = (await Category.findOne({ name: 'Water Purifiers' }).collation({ locale: 'en', strength: 2 })) ?? (await createCategory({ name: 'Water Purifiers' }));
  for (const p of products) {
    if (await Product.exists({ name: p.name })) {
      console.log(`skip   ${p.name} (already exists)`);
      continue;
    }
    const created = await createProduct(
      { name: p.name, category: String(category._id), shortDescription: p.shortDescription, description: NOTE, features: p.features, specifications: p.specifications, price: 0, stock: 0 },
      admin,
    );
    await addImages(created._id, [{ originalname: p.file, buffer: await fs.readFile(path.join(dir, p.file)) }]);
    console.log(`draft  ${p.name}  (price 0, stock 0, NOT published)`);
  }
}

main()
  .catch((error) => {
    console.error(`\nFailed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
