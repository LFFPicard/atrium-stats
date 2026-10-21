// Run with `npm test` — Node's built-in runner, importing the TypeScript module directly
// (Node 22.18+/24 strips types natively). Segments here are written already-decoded, which
// is how Next.js hands catch-all params to the route handler.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, buildSentinelPath } from '../src/lib/sentinel/proxyRules.ts';

const allowed = [
  [['users'], 'admin'],
  [['users', '12'], 'admin'],
  [['libraries'], 'admin'],
  [['geo', '1.2.3.4'], 'admin'],
  [['geo', '2001:db8::1'], 'admin'],
  [['history'], 'admin'],
  [['stats', 'server'], 'admin'],
  [['stats', 'user', '2'], 'self-or-admin'],
  [['sessions', 'live'], 'admin'],
  [['metadata', '34195'], 'any'],
  [['artwork', '34195'], 'any'],
];

for (const [path, access] of allowed) {
  test(`allows ${path.join('/')} as ${access}`, () => {
    assert.equal(classify(path)?.access, access);
  });
}

const rejected = [
  // The traversal tunnel this module exists to close: 'any'-tier prefix + decoded ../
  ['metadata', '../history'],
  ['artwork', '../history'],
  ['metadata', '../stats/leaderboard'],
  ['artwork', '../users'],
  ['metadata', '../geo/1.2.3.4'],
  ['metadata', '..'],
  ['artwork', '.'],
  ['metadata', '34195/../../history'],
  ['geo', '..'],
  ['geo', '../history'],
  ['users', '../history'],
  ['stats', 'user', '../server'],
  ['stats', 'user', '2/../1'],
  ['stats', 'user', ' 2'],
  ['stats', 'user', '0x2'],
  // Never reachable through the proxy, for any tier
  ['stats', 'leaderboard'],
  ['stats/leaderboard'],
  ['STATS', 'LEADERBOARD'],
  ['admin', 'settings'],
  ['history', 'extra'],
  ['users', '1', 'extra'],
  [],
];

for (const path of rejected) {
  test(`rejects ${JSON.stringify(path)}`, () => {
    assert.equal(classify(path), null);
  });
}

test('self-or-admin rule points at the user id segment', () => {
  assert.equal(classify(['stats', 'user', '2'])?.selfIdIndex, 2);
});

test('forwards only allow-listed query params', () => {
  const path = ['history'];
  const rule = classify(path);
  const search = new URLSearchParams('user_id=3&limit=50&offset=0&complete=true&evil=1&library_type=movie');
  assert.equal(buildSentinelPath(path, rule, search), '/history?user_id=3&limit=50&offset=0&complete=true');
});

test('drops every query param on routes that take none', () => {
  const path = ['metadata', '34195'];
  assert.equal(buildSentinelPath(path, classify(path), new URLSearchParams('user_id=1')), '/metadata/34195');
});

test('artwork keeps its type param', () => {
  const path = ['artwork', '34195'];
  assert.equal(buildSentinelPath(path, classify(path), new URLSearchParams('type=art')), '/artwork/34195?type=art');
});

test('stats keeps year/period only', () => {
  const path = ['stats', 'user', '2'];
  assert.equal(
    buildSentinelPath(path, classify(path), new URLSearchParams('period=30d&user_id=1')),
    '/stats/user/2?period=30d',
  );
});
