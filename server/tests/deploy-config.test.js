import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';

const read = (p) => JSON.parse(fs.readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'));

// Vercel only reads the vercel.json that sits in the project's Root Directory. If it is missing there, /api and every
// page route (/shop, /admin/login) answer with Vercel's own 404, which is exactly what happened in production.
describe('Vercel configuration', () => {
  for (const [file, output] of [['client/vercel.json', 'dist'], ['vercel.json', 'client/dist']]) {
    it(`${file} forwards /api to the real API and falls back to the single-page app`, () => {
      const cfg = read(file);
      assert.equal(cfg.outputDirectory, output);
      const [api, spa] = cfg.rewrites;
      assert.equal(api.source, '/api/:path*', 'the API rewrite must come first');
      assert.match(api.destination, /^https:\/\/[a-z0-9-]+\.onrender\.com\/api\/:path\*$/);
      assert.ok(!/YOUR-/i.test(api.destination), 'the placeholder host must be replaced');
      assert.deepEqual([spa.source, spa.destination], ['/(.*)', '/index.html']);
    });
  }
});
