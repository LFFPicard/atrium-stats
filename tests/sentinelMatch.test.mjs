import { test } from 'node:test';
import assert from 'node:assert/strict';

// The client reads its config at module load, so set it before importing (static imports
// are hoisted). Nothing here touches the network — fetch is stubbed where it is used.
process.env.SENTINEL_URL ??= 'http://sentinel.test';
process.env.SENTINEL_API_KEY ??= 'sk_read_test';
const { findSentinelUser, matchSentinelUser, ownerRowForUsername } = await import('../src/lib/sentinel/client.ts');

const u = (id, plexId, username, isOwner = false) => ({ id, plexId, username, displayName: null, thumb: null, isOwner });

// Shaped like a real Sentinel /v1/users response: the server owner is the Plex server's
// local account 1 (isOwner), everyone else carries their plex.tv account id.
const users = [
  u(1, '1', 'LFFPicard', true),
  u(2, '42', 'TestViewer'),
  u(3, 'tautulli_77', 'OldImport'),
  u(4, 'tautulli_78', 'Twin'),
  u(5, 'tautulli_79', 'twin'),
  // Should never exist, but must not grant admin if it does
  u(6, 'tautulli_80', 'ImportedOwner', true),
];

// The owner's real plex.tv account id — never equal to the "1" Sentinel stores.
const OWNER_PLEX_TV_ID = '8675309';

// ---- ordinary users -------------------------------------------------------------

test('ordinary user: exact plexId match, not admin, regardless of server ownership', () => {
  for (const owns of [false, true]) {
    const m = matchSentinelUser(users, '42', 'TestViewer', owns);
    assert.equal(m?.user.id, 2);
    assert.equal(m?.via, 'plexId');
    assert.equal(m?.grantsAdmin, false);
  }
});

test('ordinary user: exact match wins even if the username differs', () => {
  assert.equal(matchSentinelUser(users, '42', 'renamed-since')?.user.id, 2);
});

test('a username never matches a row that already has a real plexId', () => {
  assert.equal(matchSentinelUser(users, '999', 'TestViewer', false), null);
  assert.equal(matchSentinelUser(users, '999', 'TestViewer', true), null);
});

test('unknown account and empty username are refused', () => {
  for (const owns of [false, true]) {
    assert.equal(matchSentinelUser(users, '558', 'nobody', owns), null);
    assert.equal(matchSentinelUser(users, '558', '', owns), null);
    assert.equal(matchSentinelUser(users, '558', '   ', owns), null);
  }
});

// ---- tautulli_ placeholder fallback ---------------------------------------------

test('placeholder fallback matches case-insensitively and never grants admin', () => {
  const m = matchSentinelUser(users, '555', 'oldimport');
  assert.equal(m?.user.id, 3);
  assert.equal(m?.via, 'placeholder');
  assert.equal(m?.grantsAdmin, false);
});

test('placeholder fallback never grants admin, even on an isOwner row and with an owned server', () => {
  const m = matchSentinelUser(users, '556', 'ImportedOwner', true);
  assert.equal(m?.via, 'placeholder');
  assert.equal(m?.grantsAdmin, false);
});

test('an ambiguous placeholder username is refused', () => {
  assert.equal(matchSentinelUser(users, '557', 'Twin'), null);
  assert.equal(matchSentinelUser(users, '557', 'Twin', true), null);
});

// ---- owner fallback -------------------------------------------------------------

test('owner: matches by username when plex.tv confirms an owned server, and is admin', () => {
  const m = matchSentinelUser(users, OWNER_PLEX_TV_ID, 'LFFPicard', true);
  assert.equal(m?.user.id, 1);
  assert.equal(m?.via, 'owner');
  assert.equal(m?.grantsAdmin, true);
});

test('owner: username match is case-insensitive and trims', () => {
  assert.equal(matchSentinelUser(users, OWNER_PLEX_TV_ID, '  lffpicard ', true)?.via, 'owner');
});

test("audit M2: a different account using the owner's username WITHOUT an owned server is refused", () => {
  assert.equal(matchSentinelUser(users, '999', 'LFFPicard', false), null);
  assert.equal(matchSentinelUser(users, '999', 'lffpicard', false), null);
  // default argument is "does not own a server"
  assert.equal(matchSentinelUser(users, '999', 'LFFPicard'), null);
});

test('owning a server does not help an account whose username is not the owner row', () => {
  assert.equal(matchSentinelUser(users, '999', 'SomeoneElse', true), null);
  assert.equal(matchSentinelUser(users, '999', 'TestViewer', true), null);
});

test('owner fallback requires isOwner true AND plexId "1"', () => {
  const notOwnerFlag = [u(1, '1', 'LFFPicard', false)];
  const ownerWithOtherId = [u(1, '2', 'LFFPicard', true)];
  assert.equal(matchSentinelUser(notOwnerFlag, '999', 'LFFPicard', true), null);
  assert.equal(matchSentinelUser(ownerWithOtherId, '999', 'LFFPicard', true), null);
  assert.equal(ownerRowForUsername(notOwnerFlag, 'LFFPicard'), null);
  assert.equal(ownerRowForUsername(ownerWithOtherId, 'LFFPicard'), null);
});

test('the plex.tv account whose id happens to be "1" does not exact-match the owner row', () => {
  // "1" in Sentinel is the server-local owner id, not a plex.tv id.
  assert.equal(matchSentinelUser(users, '1', 'elan', false), null);
  assert.equal(matchSentinelUser(users, '1', 'elan', true), null);
  assert.equal(matchSentinelUser(users, '1', 'LFFPicard', false), null);
});

test('an owner row carrying a real plex.tv id still signs in by exact id, as admin', () => {
  const reconciled = [u(1, OWNER_PLEX_TV_ID, 'LFFPicard', true), u(2, '42', 'TestViewer')];
  const m = matchSentinelUser(reconciled, OWNER_PLEX_TV_ID, 'whatever', false);
  assert.equal(m?.via, 'plexId');
  assert.equal(m?.grantsAdmin, true);
});

// ---- findSentinelUser: when plex.tv is asked ------------------------------------

async function withUsers(list, fn) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ users: list }), { status: 200 });
  try {
    return await fn();
  } finally {
    globalThis.fetch = realFetch;
  }
}

test('findSentinelUser does not ask plex.tv for ordinary or placeholder sign-ins, or unknown names', async () => {
  let asked = 0;
  const check = async () => {
    asked++;
    return true;
  };
  await withUsers(users, async () => {
    assert.equal((await findSentinelUser('42', 'TestViewer', check))?.via, 'plexId');
    assert.equal((await findSentinelUser('555', 'OldImport', check))?.via, 'placeholder');
    assert.equal(await findSentinelUser('999', 'nobody', check), null);
    assert.equal(await findSentinelUser('999', 'TestViewer', check), null);
  });
  assert.equal(asked, 0);
});

test('findSentinelUser asks plex.tv once for the owner username and honours the answer', async () => {
  let asked = 0;
  await withUsers(users, async () => {
    const yes = await findSentinelUser(OWNER_PLEX_TV_ID, 'LFFPicard', async () => (asked++, true));
    assert.equal(yes?.via, 'owner');
    assert.equal(yes?.grantsAdmin, true);
    const no = await findSentinelUser('999', 'LFFPicard', async () => (asked++, false));
    assert.equal(no, null);
  });
  assert.equal(asked, 2);
});
