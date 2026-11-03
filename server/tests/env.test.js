import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EnvError, loadEnv } from '../src/config/env.js';

const SECRET_A = 'a'.repeat(40);
const SECRET_B = 'b'.repeat(40);

describe('loadEnv', () => {
  it('applies development defaults', () => {
    const env = loadEnv({});
    assert.equal(env.NODE_ENV, 'development');
    assert.equal(env.PORT, 5000);
    assert.deepEqual(env.CLIENT_ORIGINS, ['http://localhost:5173']);
  });

  it('treats blank values as unset', () => {
    const env = loadEnv({ MONGODB_URI: '', JWT_ACCESS_SECRET: '  ' });
    assert.equal(env.MONGODB_URI, undefined);
    assert.equal(env.JWT_ACCESS_SECRET, undefined);
  });

  it('rejects a MongoDB URI with the wrong scheme', () => {
    assert.throws(() => loadEnv({ MONGODB_URI: 'http://nope' }), EnvError);
  });

  it('parses multiple CLIENT_URL origins', () => {
    const env = loadEnv({ CLIENT_URL: 'https://a.example.com, https://b.example.com' });
    assert.deepEqual(env.CLIENT_ORIGINS, ['https://a.example.com', 'https://b.example.com']);
  });

  it('rejects an invalid CLIENT_URL', () => {
    assert.throws(() => loadEnv({ CLIENT_URL: 'not a url' }), EnvError);
  });

  it('requires database and JWT secrets in production', () => {
    assert.throws(() => loadEnv({ NODE_ENV: 'production' }), /MONGODB_URI.*required in production/s);
  });

  it('rejects short or identical JWT secrets in production', () => {
    const base = { NODE_ENV: 'production', MONGODB_URI: 'mongodb://localhost/x' };
    assert.throws(() => loadEnv({ ...base, JWT_ACCESS_SECRET: 'short', JWT_REFRESH_SECRET: SECRET_B }));
    assert.throws(
      () => loadEnv({ ...base, JWT_ACCESS_SECRET: SECRET_A, JWT_REFRESH_SECRET: SECRET_A }),
      /must differ/,
    );
    const ok = loadEnv({ ...base, JWT_ACCESS_SECRET: SECRET_A, JWT_REFRESH_SECRET: SECRET_B });
    assert.equal(ok.isProduction, true);
  });
});
