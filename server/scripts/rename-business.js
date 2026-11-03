// One-off: changes only the stored business name from "VR Enterprises" to "VR Water Solutions".
// Touches nothing else (phone, email, address, products, prices stay as they are). Safe to run twice.
// Usage: node scripts/rename-business.js
import 'dotenv/config';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Settings } from '../src/models/Settings.js';

const OLD_NAME = 'VR Enterprises';
const NEW_NAME = 'VR Water Solutions';

async function main() {
  await connectDB();
  const doc = await Settings.findOne({ key: 'store' }).lean();
  const current = doc?.business?.name;
  if (current === NEW_NAME) return console.log(`Already "${NEW_NAME}". Nothing to do.`);
  if (current !== OLD_NAME) return console.log(`Current name is "${current}", not "${OLD_NAME}". Left unchanged.`);
  await Settings.updateOne({ key: 'store', 'business.name': OLD_NAME }, { $set: { 'business.name': NEW_NAME } });
  console.log(`Business name changed: "${OLD_NAME}" -> "${NEW_NAME}".`);
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => disconnectDB());
