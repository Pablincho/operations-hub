import test from 'node:test';
import assert from 'node:assert/strict';
import { encrypt, decrypt, isEncrypted } from '../src/utils/crypto.js';

test('los datos sensibles se cifran con autenticación y pueden recuperarse', () => {
  process.env.SENSITIVE_DATA_KEY = 'ab'.repeat(32);
  const plain = 'credencial extremadamente sensible';
  const encrypted = encrypt(plain);

  assert.notEqual(encrypted, plain);
  assert.equal(isEncrypted(encrypted), true);
  assert.equal(decrypt(encrypted), plain);
});

test('el cifrado usa un IV diferente en cada operación', () => {
  process.env.SENSITIVE_DATA_KEY = 'cd'.repeat(32);
  assert.notEqual(encrypt('mismo texto'), encrypt('mismo texto'));
});
