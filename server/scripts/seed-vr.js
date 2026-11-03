/**
 * Loads the real VR Water Solutions content: business details, the five purifier products with the supplied photos,
 * and the homepage banner. Safe to re-run: nothing that already exists is overwritten.
 *
 *   npm run seed:vr
 *
 * TEMPORARY VALUES: the owner asked for the products to be added before final prices and stock were known. Every
 * price below and the opening stock of 5 are TEMPORARY, chosen only as plausible starting figures for Indian water
 * purifiers; they are NOT quotes. The owner must verify and change them in Admin > Products and Inventory. Specifications,
 * features and warranty text use only facts from the supplied product titles. Amazon links are references only.
 * Photos: only the confirmed mappings are used; products 2 and 3 get a neutral "photo coming soon" placeholder.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { ROLES } from '../src/constants/roles.js';
import { Banner } from '../src/models/Banner.js';
import { Category } from '../src/models/Category.js';
import { InventoryLog } from '../src/models/InventoryLog.js';
import { Product } from '../src/models/Product.js';
import { Settings } from '../src/models/Settings.js';
import { User } from '../src/models/User.js';
import { createBanner, setBannerImage } from '../src/services/banner.service.js';
import { createCategory } from '../src/services/category.service.js';
import { addImages, createProduct, updateProduct } from '../src/services/product.service.js';
import { adjustStock } from '../src/services/inventory.service.js';
import { getSettings } from '../src/services/settings.service.js';

const seedDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../seed');

const BUSINESS = {
  phone: '9346411218',
  email: 'maheswarreddygondireddy12@gmail.com',
  address: 'Yerraguntla Circle, Dharmavaram, Andhra Pradesh, India.',
};

const CATEGORY = 'Water Purifiers';

const products = [
  {
    name: 'Aqua Pearl Copper RO Water Purifier',
    reference: 'https://amzn.in/d/00EAfHxB',
    shortDescription: 'Wall-mounted RO + UV purifier with copper, zinc and alkaline stages and a 12-litre storage tank.',
    description: [
      'The Aqua Pearl Copper RO Water Purifier combines RO and UV purification with copper, zinc and alkaline stages. It is an electric, wall-mounted unit with a 12-litre storage tank and an advance HTDS membrane, rated at 20 litres per hour.',
      'The product title also mentions pH and B12. Ask us for the details of these before you book.',
      'The title states a 1-year warranty on the pump and SMPS. Ask us for the full warranty terms that apply before you confirm a booking.',
    ].join('\n\n'),
    features: ['RO + UV purification', 'Copper + Zinc + Alkaline stages', '12-litre storage capacity', '20 LPH purification rate', 'Wall-mounted, electric', 'Advance HTDS membrane', '1-year warranty on pump and SMPS (as stated in the product title)'],
    specifications: [
      { group: 'Purification', items: [{ label: 'Technology', value: 'RO + UV' }, { label: 'Mineral stages', value: 'Copper + Zinc + Alkaline' }, { label: 'Membrane', value: 'Advance HTDS membrane' }, { label: 'Also mentioned in the product title', value: 'pH and B12 (details to be confirmed)' }] },
      { group: 'Capacity', items: [{ label: 'Storage capacity', value: '12 litres' }, { label: 'Purification rate', value: '20 LPH' }] },
      { group: 'Installation and power', items: [{ label: 'Mounting', value: 'Wall-mounted' }, { label: 'Power', value: 'Electric' }] },
      { group: 'Warranty', items: [{ label: 'Stated warranty', value: '1 year on pump and SMPS' }] },
    ],
  },
  {
    name: 'G+ Series 3+ Copper Triple Layer Protection Water Purifier',
    reference: 'https://amzn.in/d/0eszee8i',
    shortDescription: 'White digital-display purifier with RO, copper, zinc, alkaline, UV and UF stages and a 12-litre tank.',
    description: [
      'The G+ Series 3+ Copper Triple Layer Protection Water Purifier is a white purifier with a digital display and a multi-stage purification process: RO + Copper + Zinc + Alkaline + UV + UF. It has a 12-litre capacity.',
      'The product title also mentions an LED tank / LED display. Ask us for details before you book.',
    ].join('\n\n'),
    features: ['RO + Copper + Zinc + Alkaline + UV + UF purification', 'Digital display', '12-litre capacity', 'White colour'],
    specifications: [
      { group: 'Purification', items: [{ label: 'Process', value: 'RO + Copper + Zinc + Alkaline + UV + UF' }] },
      { group: 'Design and display', items: [{ label: 'Colour', value: 'White' }, { label: 'Display', value: 'Digital display' }, { label: 'Also mentioned in the product title', value: 'LED tank / LED display (details to be confirmed)' }] },
      { group: 'Capacity', items: [{ label: 'Storage capacity', value: '12 litres' }] },
    ],
  },
  {
    name: 'G+ Series Copper Rich Digital Display Water Purifier',
    reference: 'https://amzn.in/d/0ajz2JpY',
    shortDescription: 'G+ Series purifier with copper-rich purification and a digital display.',
    description: [
      'The G+ Series Copper Rich Digital Display Water Purifier offers copper-rich purification with a digital display.',
      'The product title also mentions Oxidation Reduction Potential (ORP). Ask us for details of this feature before you book.',
    ].join('\n\n'),
    features: ['Copper-rich purification', 'Digital display'],
    specifications: [
      { group: 'Purification', items: [{ label: 'Process', value: 'Copper-rich purification' }, { label: 'Also mentioned in the product title', value: 'Oxidation Reduction Potential (ORP) (details to be confirmed)' }] },
      { group: 'Design and display', items: [{ label: 'Display', value: 'Digital display' }] },
    ],
  },
  {
    name: 'G Series RO + UV Water Purifier',
    reference: 'https://amzn.in/d/0hVwTYB7',
    shortDescription: 'G Series RO + UV purifier with copper and zinc technology in a black and copper design.',
    description: [
      'The G Series RO + UV Water Purifier combines RO and UV purification with copper and zinc technology, in a black and copper design.',
    ].join('\n\n'),
    features: ['RO + UV purification', 'Copper + Zinc technology', 'Black and copper design'],
    specifications: [
      { group: 'Purification', items: [{ label: 'Technology', value: 'RO + UV' }, { label: 'Mineral technology', value: 'Copper + Zinc' }] },
      { group: 'Design', items: [{ label: 'Colour and finish', value: 'Black and copper' }] },
    ],
  },
  {
    name: 'G+ Series DigiPro RO UV UF Water Purifier',
    reference: 'https://amzn.in/d/02ejFca0',
    shortDescription: '7-stage RO + UV + UF purifier with copper, zinc and alkaline stages, digital display, TDS controller and 12-litre capacity.',
    description: [
      'The G+ Series DigiPro RO UV UF Water Purifier is a 7-stage purifier with copper, zinc and alkaline stages, a digital display, a TDS controller and an 80 GPD RO membrane. It has a 12-litre capacity.',
    ].join('\n\n'),
    features: ['7-stage purification', 'RO + UV + UF', 'Copper + Zinc + Alkaline', 'Digital display', 'TDS controller', '80 GPD RO membrane', '12-litre capacity'],
    specifications: [
      { group: 'Purification', items: [{ label: 'Technology', value: 'RO + UV + UF' }, { label: 'Stages', value: '7-stage purification' }, { label: 'Mineral stages', value: 'Copper + Zinc + Alkaline' }, { label: 'TDS controller', value: 'Yes' }, { label: 'RO membrane', value: '80 GPD' }] },
      { group: 'Design and display', items: [{ label: 'Display', value: 'Digital display' }] },
      { group: 'Capacity', items: [{ label: 'Storage capacity', value: '12 litres' }] },
    ],
  },
];

// TEMPORARY prices (INR) and opening stock: see the note above. Edit them in the admin, never here, after the first run.
const TEMP_STOCK = 5;
const TEMP_STOCK_NOTE = 'TEMPORARY opening stock (5 units): the owner must verify and correct this';

const PLACEHOLDER = 'placeholders/product-placeholder.jpg';
const PLACEHOLDER_ALT = 'Product photo coming soon (placeholder, not the product)';

const catalogue = {
  'Aqua Pearl Copper RO Water Purifier': { price: 7999, images: ['products/aqua-pearl-copper-ro.jpg'], featured: true },
  'G+ Series 3+ Copper Triple Layer Protection Water Purifier': { price: 11499, images: [PLACEHOLDER], placeholder: true },
  'G+ Series Copper Rich Digital Display Water Purifier': { price: 9499, images: [PLACEHOLDER], placeholder: true },
  'G Series RO + UV Water Purifier': { price: 8499, images: ['products/g-series-ro-uv.jpg'], featured: true },
  'G+ Series DigiPro RO UV UF Water Purifier': { price: 10999, images: ['products/g-plus-digipro.jpg'], featured: true },
};

const BANNER = { title: 'Pure Water. Better Living.', subtitle: 'Explore reliable water purification solutions for your home.', ctaLabel: 'Explore Purifiers', linkUrl: '/shop' };

async function seedSettings() {
  const settings = await getSettings();
  const set = {};
  for (const [key, value] of Object.entries(BUSINESS)) if (!settings.business[key]) set[`business.${key}`] = value;
  if (Object.keys(set).length) await Settings.updateOne({ key: 'store' }, { $set: set });
  console.log(Object.keys(set).length ? `settings: filled ${Object.keys(set).map((k) => k.split('.')[1]).join(', ')}` : 'settings: already filled, left as is');
}

/**
 * Creates each product if missing, then fills in ONLY what is still empty: a price of 0, no stock history, no photos.
 * Anything the owner has already edited in the admin is never overwritten.
 */
async function seedProducts(admin) {
  const category = (await Category.findOne({ name: CATEGORY }).collation({ locale: 'en', strength: 2 })) ?? (await createCategory({ name: CATEGORY }));
  for (const p of products) {
    const temp = catalogue[p.name];
    let product = await Product.findOne({ name: p.name });
    if (!product) {
      product = await createProduct({ name: p.name, category: String(category._id), shortDescription: p.shortDescription, description: p.description, features: p.features, specifications: p.specifications, price: temp.price, stock: 0 }, admin);
      console.log(`added   ${p.name}  (TEMPORARY price ${temp.price})`);
    } else if (product.price === 0) {
      await Product.updateOne({ _id: product._id }, { $set: { price: temp.price } });
      console.log(`price   ${p.name}  TEMPORARY ${temp.price}`);
    } else {
      console.log(`keep    ${p.name}  (price already set to ${product.price})`);
    }

    if ((await Product.findById(product._id)).stock === 0 && !(await InventoryLog.exists({ product: product._id, note: /^TEMPORARY opening stock/ }))) {
      await adjustStock(product._id, { type: 'add', quantity: TEMP_STOCK, reason: 'other', note: TEMP_STOCK_NOTE }, admin);
      console.log(`        stock ${TEMP_STOCK} (TEMPORARY)`);
    }

    if ((await Product.findById(product._id)).images.length === 0) {
      const files = await Promise.all(temp.images.map(async (rel) => ({ originalname: path.basename(rel), buffer: await fs.readFile(path.join(seedDir, rel)) })));
      await addImages(product._id, files);
      if (temp.placeholder) await Product.updateOne({ _id: product._id }, { $set: { 'images.0.alt': PLACEHOLDER_ALT } });
      await updateProduct(product._id, { status: 'published', isFeatured: Boolean(temp.featured) }, admin);
      console.log(`        photo: ${temp.images.join(', ')}${temp.placeholder ? ' (placeholder)' : ''}; published`);
    }
  }
}

async function seedBanner() {
  if (await Banner.exists({ title: BANNER.title })) return console.log('banner: already exists');
  const banner = await createBanner({ ...BANNER, isActive: true, sortOrder: 0 });
  await setBannerImage(banner._id, { originalname: 'vr-banner.jpg', buffer: await fs.readFile(path.join(seedDir, 'banner', 'vr-banner.jpg')) });
  console.log('banner: created');
}

async function main() {
  if (env.isProduction && !process.env.ALLOW_SEED_IN_PRODUCTION) throw new Error('Set ALLOW_SEED_IN_PRODUCTION=1 to run this against a production database.');
  await connectDB();
  const admin = await User.findOne({ role: ROLES.ADMIN });
  if (!admin) throw new Error('Create the first admin first: npm run create-admin');
  await seedSettings();
  await seedProducts(admin);
  await seedBanner();
  console.log('\nDone. All prices and the stock of 5 per product are TEMPORARY: verify and change them in Admin > Products and Inventory.');
}

main()
  .catch((error) => {
    console.error(`\nSeeding failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
