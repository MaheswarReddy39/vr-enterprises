import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashPassword, passwordPolicyErrors, verifyPassword } from '../src/utils/password.js';

describe('password utils', () => {
  it('accepts a strong password', () => {
    assert.deepEqual(passwordPolicyErrors('Str0ng!Passw0rd'), []);
  });

  it('reports every violated rule', () => {
    assert.equal(passwordPolicyErrors('short').length, 4);
    assert.ok(passwordPolicyErrors('alllowercase1!').some((e) => /uppercase/.test(e)));
    assert.ok(passwordPolicyErrors('A1!' + 'a'.repeat(80)).some((e) => /at most/.test(e)));
  });

  it('hashes with bcrypt and verifies', async () => {
    const hash = await hashPassword('Str0ng!Passw0rd');
    assert.notEqual(hash, 'Str0ng!Passw0rd');
    assert.match(hash, /^\$2[aby]\$12\$/);
    assert.equal(await verifyPassword('Str0ng!Passw0rd', hash), true);
    assert.equal(await verifyPassword('wrong', hash), false);
  });
});
