// The only place in Atrium Stats that ever holds the Sentinel read API key.
// Only import this from server-side code (Server Components, Route Handlers) —
// never from a "use client" component. See app/api/sentinel/[...path]/route.ts
// for the generic proxy client components use instead.

const SENTINEL_URL = process.env.SENTINEL_URL;
const SENTINEL_API_KEY = process.env.SENTINEL_API_KEY;

export class SentinelError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'SentinelError';
    this.status = status;
  }
}

export function sentinelConfigured(): boolean {
  return Boolean(SENTINEL_URL && SENTINEL_API_KEY);
}

function baseUrl(): string {
  if (!SENTINEL_URL) {
    throw new Error('SENTINEL_URL is not configured — set it in the environment before calling Sentinel.');
  }
  return `${SENTINEL_URL.replace(/\/+$/, '')}/v1`;
}

function authHeaders(): Record<string, string> {
  if (!SENTINEL_API_KEY) {
    throw new Error('SENTINEL_API_KEY is not configured — set it in the environment before calling Sentinel.');
  }
  return { Authorization: `Bearer ${SENTINEL_API_KEY}` };
}

/** Low-level JSON fetch against Sentinel's REST API. `path` starts with `/`, no `/v1` prefix. */
export async function sentinelFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // Resolved outside the try so a missing SENTINEL_URL / key reports as the
  // configuration error it is, not as "could not reach".
  const url = `${baseUrl()}${path}`;
  const headers = { ...authHeaders(), ...(init?.headers ?? {}) };

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, cache: 'no-store' });
  } catch (err) {
    // undici reports every network failure as a bare "fetch failed" — keep the real
    // reason (ECONNREFUSED, ENOTFOUND, ...) attached as the cause.
    throw new Error(`Sentinel request failed: could not reach ${path}`, { cause: err });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new SentinelError(`Sentinel request failed: ${res.status} ${path}${body ? ` — ${body}` : ''}`, res.status);
  }

  return res.json() as Promise<T>;
}

/**
 * Raw fetch against Sentinel — returns the Response itself rather than parsed JSON.
 * Used for binary responses (artwork) and by the generic /api/sentinel proxy, which
 * forwards status/headers/body through as-is instead of assuming JSON.
 */
export async function sentinelFetchRaw(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
}

export type SentinelUser = {
  id: number;
  plexId: string;
  username: string;
  displayName: string | null;
  thumb: string | null;
  isOwner: boolean;
  totalSessions?: number;
};

export async function getUsers(): Promise<SentinelUser[]> {
  const data = await sentinelFetch<{ users: SentinelUser[] }>('/users');
  return data.users;
}

export async function getUserById(id: number): Promise<SentinelUser | null> {
  try {
    const data = await sentinelFetch<{ user: SentinelUser }>(`/users/${id}`);
    return data.user;
  } catch (err) {
    if (err instanceof SentinelError && err.status === 404) return null;
    throw err;
  }
}

// Sentinel's Tautulli importer creates users under this placeholder plexId until
// syncUsers reconciles them with the real Plex account.
const PLACEHOLDER_PLEX_ID_PREFIX = 'tautulli_';

// Sentinel's collector reads users from the Plex server's own account list, where the
// server owner is always local account 1 (syncUsers sets isOwner on exactly that row).
// That "1" is a server-local id, NOT the owner's plex.tv account id — so the owner's
// plex.tv id never equals it and the owner can never sign in by exact id match.
const OWNER_LOCAL_PLEX_ID = '1';

function isOwnerLocalRow(u: SentinelUser): boolean {
  return u.isOwner === true && u.plexId === OWNER_LOCAL_PLEX_ID;
}

export type SentinelUserMatch = {
  user: SentinelUser;
  // How the row was matched:
  //   'plexId'      — the plex.tv account id equals the row's plexId (proves identity)
  //   'placeholder' — username match against an unreconciled tautulli_ row
  //   'owner'       — username match against the owner row, backed by plex.tv confirming
  //                   the signing-in account owns a Plex server
  via: 'plexId' | 'placeholder' | 'owner';
  // The only thing callers should use to decide admin. Never true for 'placeholder'.
  grantsAdmin: boolean;
};

/**
 * True when a username-only match against the owner row is possible — i.e. it is worth
 * asking plex.tv whether this account owns a server. Pure; no network.
 */
export function ownerRowForUsername(users: readonly SentinelUser[], username: string): SentinelUser | null {
  const lower = username.trim().toLowerCase();
  if (!lower) return null;
  const rows = users.filter((u) => isOwnerLocalRow(u) && u.username.toLowerCase() === lower);
  return rows.length === 1 ? rows[0] : null;
}

/**
 * Pure matching rules for sign-in (unit-tested in tests/sentinelMatch.test.mjs):
 *
 * 1. Exact plexId match — the only match that proves identity by id. The owner row is
 *    excluded: its plexId "1" is a server-local id, so a plex.tv account that happens to
 *    have id 1 must not match it.
 * 2. Otherwise, a case-insensitive username match against rows still sitting under an
 *    unreconciled `tautulli_{id}` placeholder. Never grants admin. Ambiguous names are
 *    refused.
 * 3. Otherwise, the owner fallback: a case-insensitive username match against the row
 *    with isOwner true AND plexId "1", and only when `ownsPlexServer` is true — the
 *    caller has asked plex.tv, with this user's own token, whether the account owns a
 *    Plex server. This is the only fallback that grants admin.
 *
 * A row that has a real plexId is never matched by username: that would let anyone
 * holding a recycled or look-alike username sign in as that user.
 */
export function matchSentinelUser(
  users: readonly SentinelUser[],
  plexId: string,
  username: string,
  ownsPlexServer = false,
): SentinelUserMatch | null {
  const exact = users.find((u) => u.plexId === plexId && !isOwnerLocalRow(u));
  if (exact) return { user: exact, via: 'plexId', grantsAdmin: exact.isOwner === true };

  const lowerUsername = username.trim().toLowerCase();
  if (!lowerUsername) return null;

  const placeholders = users.filter(
    (u) =>
      typeof u.plexId === 'string' &&
      u.plexId.startsWith(PLACEHOLDER_PLEX_ID_PREFIX) &&
      u.username.toLowerCase() === lowerUsername,
  );
  if (placeholders.length > 1) return null;
  if (placeholders.length === 1) return { user: placeholders[0], via: 'placeholder', grantsAdmin: false };

  if (ownsPlexServer === true) {
    const owner = ownerRowForUsername(users, username);
    if (owner) return { user: owner, via: 'owner', grantsAdmin: true };
  }

  return null;
}

/**
 * Finds the Sentinel user matching a Plex account — see matchSentinelUser for the rules.
 * `checkOwnsPlexServer` is only called when the owner fallback is the last option left
 * (no exact or placeholder match, and the username matches the owner row), so ordinary
 * sign-ins never make the extra plex.tv request.
 */
export async function findSentinelUser(
  plexId: string,
  username: string,
  checkOwnsPlexServer: () => Promise<boolean>,
): Promise<SentinelUserMatch | null> {
  const users = await getUsers();

  const direct = matchSentinelUser(users, plexId, username, false);
  if (direct) return direct;

  if (!ownerRowForUsername(users, username)) return null;
  const owns = await checkOwnsPlexServer();
  return matchSentinelUser(users, plexId, username, owns);
}

export type SentinelLibrary = {
  id: number;
  plexKey: string;
  name: string;
  type: string;
  metadataCount: number;
};

export async function getLibraries(): Promise<SentinelLibrary[]> {
  const data = await sentinelFetch<{ libraries: SentinelLibrary[] }>('/libraries');
  return data.libraries;
}

export type SentinelMetadata = {
  id: number;
  ratingKey: string;
  parentKey: string | null;
  grandparentKey: string | null;
  libraryId: number | null;
  type: string;
  title: string;
  grandparentTitle: string | null;
  parentTitle: string | null;
  year: number | null;
  thumb: string | null;
  art: string | null;
  duration: number | null;
  studio: string | null;
  contentRating: string | null;
  summary: string | null;
  plexAddedAt: number | null;
};

export async function getMetadata(ratingKey: string): Promise<SentinelMetadata | null> {
  try {
    return await sentinelFetch<SentinelMetadata>(`/metadata/${ratingKey}`);
  } catch (err) {
    if (err instanceof SentinelError && err.status === 404) return null;
    throw err;
  }
}
