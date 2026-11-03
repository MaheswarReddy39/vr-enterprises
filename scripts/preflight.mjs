// Runs before `npm run dev`: explains missing setup in plain words instead of letting the API crash and
// concurrently tear Vite down with a wall of npm errors.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const envFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../server/.env');
const fromFile = {};
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !line.trim().startsWith('#')) fromFile[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
}
const get = (key) => process.env[key] || fromFile[key];

const problems = [];
if (!fs.existsSync(envFile) && !process.env.MONGODB_URI) problems.push('server/.env does not exist. Run:  npm run setup');
// A common mistake: pasting the real connection string into .env.example (which is shared) instead of .env (which the app reads).
const example = path.resolve(path.dirname(envFile), '.env.example');
if (fs.existsSync(example) && /^MONGODB_URI=\S*:\/\/[^/@\s<]+:[^/@\s<]+@/m.test(fs.readFileSync(example, 'utf8'))) problems.push('server/.env.example contains a real database user and password. Move the connection string to server/.env (the file the app reads) and change the password, because the example file is meant to be shared.');
if (!get('MONGODB_URI')) problems.push('MONGODB_URI is empty. Put your MongoDB Atlas connection string in server/.env');
for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
  if ((get(key) ?? '').length < 32) problems.push(`${key} is missing or shorter than 32 characters (npm run setup generates both).`);
}

if (problems.length) {
  console.error('\nThe API cannot start yet:\n' + problems.map((p) => `  - ${p}`).join('\n') + '\n\nSee "Quick start" in README.md.\n');
  process.exit(1);
}
