// Loaded before every test file so tests never depend on a developer's local server/.env.
// dotenv does not override variables that are already set, so setting/blanking them here is enough.
import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';
// A developer's real WhatsApp credentials must never be used by tests: blank them so no real message can be sent.
for (const key of ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID']) process.env[key] = '';
// Throwaway secrets generated per test process; they exist only in memory.
process.env.JWT_ACCESS_SECRET = crypto.randomBytes(32).toString('hex');
process.env.JWT_REFRESH_SECRET = crypto.randomBytes(32).toString('hex');
