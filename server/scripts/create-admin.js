/**
 * Creates the first administrator account.
 *
 *   npm run create-admin
 *   npm run create-admin -- --name "Full Name" --email you@example.com
 *
 * The password is never accepted as a command-line argument (it would end up in shell history).
 * It is prompted for with hidden input, or read from ADMIN_PASSWORD for non-interactive use.
 * The script refuses to run if an admin already exists.
 */
import { Writable } from 'node:stream';
import readline from 'node:readline';
import { parseArgs } from 'node:util';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { createFirstAdmin } from '../src/services/adminSetup.service.js';
import { ApiError } from '../src/utils/ApiError.js';

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const mutedOutput = new Writable({ write: (_chunk, _enc, done) => done() });
    const rl = readline.createInterface({
      input: process.stdin,
      output: hidden ? mutedOutput : process.stdout,
      terminal: hidden ? true : undefined,
    });
    if (hidden) process.stdout.write(question);
    rl.question(hidden ? '' : question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

async function readPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (!process.stdin.isTTY) {
    throw new ApiError(400, 'No terminal available. Set ADMIN_PASSWORD in the environment instead.');
  }
  const password = await ask('Password (input hidden): ', { hidden: true });
  const confirmation = await ask('Confirm password:       ', { hidden: true });
  if (password !== confirmation) throw new ApiError(400, 'Passwords do not match.');
  return password;
}

async function main() {
  const { values } = parseArgs({
    options: { name: { type: 'string' }, email: { type: 'string' } },
  });

  const name = values.name ?? (await ask('Admin full name: '));
  const email = values.email ?? (await ask('Admin email: '));
  const password = await readPassword();

  await connectDB();
  const admin = await createFirstAdmin({ name, email, password });
  console.log(`\nAdmin account created for ${admin.email}. You can now sign in to the dashboard.`);
}

main()
  .catch((error) => {
    console.error(`\nCould not create admin: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
