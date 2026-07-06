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
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
    cache: 'no-store',
  });

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

/**
 * Finds the Sentinel user matching a Plex account, following the fallback rules from
 * the Auth Architecture spec: exact plexId match first, then case-insensitive username
 * match (catches Tautulli-imported users still sitting under a `tautulli_{id}` placeholder
 * because syncUsers hasn't reconciled them yet).
 */
export async function findSentinelUser(plexId: string, username: string): Promise<SentinelUser | null> {
  const users = await getUsers();
  const exact = users.find((u) => u.plexId === plexId);
  if (exact) return exact;

  const lowerUsername = username.toLowerCase();
  return users.find((u) => u.username.toLowerCase() === lowerUsername) ?? null;
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
