// `npm run setup`: creates server/.env from the example and fills in freshly generated JWT secrets.
// It never overwrites an existing file. You still add MONGODB_URI yourself.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../server');
const target = path.join(dir, '.env');

if (fs.existsSync(target)) {
  console.log('server/.env already exists; leaving it untouched.');
  process.exit(0);
}
const secret = () => crypto.randomBytes(48).toString('hex');
const text = fs
  .readFileSync(path.join(dir, '.env.example'), 'utf8')
  .replace(/^JWT_ACCESS_SECRET=.*$/m, `JWT_ACCESS_SECRET=${secret()}`)
  .replace(/^JWT_REFRESH_SECRET=.*$/m, `JWT_REFRESH_SECRET=${secret()}`);
fs.writeFileSync(target, text, { mode: 0o600 });
console.log('Created server/.env with generated JWT secrets.\nNext: open it and set MONGODB_URI (your MongoDB Atlas connection string).');
