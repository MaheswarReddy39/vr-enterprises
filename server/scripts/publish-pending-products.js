/**
 * Publishes the four label-only purifiers with TEMPORARY price and stock, as the owner approved. These numbers are
 * placeholders chosen only as plausible starting figures, NOT quotes: the owner must verify and change them in
 * Admin > Products and Inventory. Never overwrites a price or stock the owner has already set.
 *
 *   node scripts/publish-pending-products.js
 */
import { connectDB, disconnectDB } from '../src/config/db.js';
import { ROLES } from '../src/constants/roles.js';
import { InventoryLog } from '../src/models/InventoryLog.js';
import { Product } from '../src/models/Product.js';
import { User } from '../src/models/User.js';
import { adjustStock } from '../src/services/inventory.service.js';
import { updateProduct } from '../src/services/product.service.js';

const TEMP_STOCK = 5;
const NOTE = 'TEMPORARY opening stock (5 units): the owner must verify and correct this';
const prices = {
  'AQUA Water Purifier (RO+UV+UF)': 6499,
  'Sapphire Vogue Signature PRO Series Water Purifier': 11999,
  'Pearl Copper Water Purifier (RO+UV+UF+TDS Control)': 8499,
  'Purosis Elite Water Purifier (RO+UV+UF+TDS)': 12499,
};

async function main() {
  await connectDB();
  const admin = await User.findOne({ role: ROLES.ADMIN });
  if (!admin) throw new Error('Create the first admin first: npm run create-admin');
  for (const [name, price] of Object.entries(prices)) {
    const p = await Product.findOne({ name });
    if (!p) {
      console.log(`missing ${name} (run scripts/add-pending-products.js first)`);
      continue;
    }
    if (p.price === 0) await Product.updateOne({ _id: p._id }, { $set: { price } });
    if (p.stock === 0 && !(await InventoryLog.exists({ product: p._id, note: /^TEMPORARY opening stock/ }))) {
      await adjustStock(p._id, { type: 'add', quantity: TEMP_STOCK, reason: 'other', note: NOTE }, admin);
    }
    if (p.status === 'draft') await updateProduct(p._id, { status: 'published' }, admin);
    const now = await Product.findById(p._id);
    console.log(`${now.status.padEnd(9)} price ${now.price} (TEMPORARY)  stock ${now.stock} (TEMPORARY)  ${name}`);
  }
}

main()
  .catch((error) => {
    console.error(`\nFailed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
