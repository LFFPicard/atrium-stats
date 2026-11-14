import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasOwnedServer } from '../src/lib/auth/plex.ts';
import { describeError } from '../src/lib/errors.ts';

test('an owned Plex Media Server counts', () => {
  assert.equal(hasOwnedServer([{ name: 'Vault', provides: 'server', owned: true }]), true);
  assert.equal(
    hasOwnedServer([
      { name: 'Phone', provides: 'client,player', owned: true },
      { name: 'Vault', provides: 'server', owned: true },
    ]),
    true,
  );
  assert.equal(hasOwnedServer([{ provides: 'client, Server', owned: true }]), true);
});

test('a server merely shared with the account does not count', () => {
  assert.equal(hasOwnedServer([{ name: 'Friend', provides: 'server', owned: false }]), false);
});

test('owned players/clients do not count', () => {
  assert.equal(hasOwnedServer([{ name: 'TV', provides: 'client,player', owned: true }]), false);
  assert.equal(hasOwnedServer([{ name: 'x', provides: 'observer', owned: true }]), false);
});

test('owned must be exactly true', () => {
  for (const owned of ['true', 1, '1', null, undefined]) {
    assert.equal(hasOwnedServer([{ provides: 'server', owned }]), false);
  }
});

test('malformed responses are treated as "owns nothing"', () => {
  for (const body of [null, undefined, {}, 'server', [], [null], ['server'], [{ owned: true }], { owned: true, provides: 'server' }]) {
    assert.equal(hasOwnedServer(body), false);
  }
});

test('describeError surfaces the cause chain instead of a bare "fetch failed"', () => {
  const sys = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:7701'), { code: 'ECONNREFUSED' });
  const undici = new TypeError('fetch failed', { cause: sys });
  const wrapped = new Error('Sentinel request failed: could not reach /users', { cause: undici });
  assert.equal(
    describeError(wrapped),
    'Sentinel request failed: could not reach /users — cause: fetch failed — cause: connect ECONNREFUSED 127.0.0.1:7701',
  );
  const dns = Object.assign(new Error('getaddrinfo failed'), { code: 'ENOTFOUND' });
  assert.equal(describeError(new TypeError('fetch failed', { cause: dns })), 'fetch failed — cause: getaddrinfo failed [ENOTFOUND]');
  assert.equal(describeError('plain string'), 'plain string');
  assert.equal(describeError(new Error('no cause')), 'no cause');
});
