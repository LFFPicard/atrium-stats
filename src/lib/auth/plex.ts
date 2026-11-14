// Plex OAuth via the PIN-based device-linking flow (the same approach used by Overseerr,
// Tautulli, Ombi etc. — Plex has no classic redirect-with-code OAuth2 flow). The user is
// sent to app.plex.tv/auth, and once they approve, Plex forwards the browser back to our
// callback route while we poll the pin server-side for the resulting auth token.

const PLEX_PRODUCT = 'Atrium Stats';

// Short-lived cookie holding the pending pin's id between the redirect to Plex and the
// callback route reading it back. Not the session cookie — see lib/auth/session.ts for that.
export const PLEX_PIN_COOKIE = 'plex_pin_pending';

function clientIdentifier(): string {
  const id = process.env.PLEX_CLIENT_IDENTIFIER;
  if (!id) throw new Error('PLEX_CLIENT_IDENTIFIER is not configured.');
  return id;
}

function plexHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    Accept: 'application/json',
    'X-Plex-Product': PLEX_PRODUCT,
    'X-Plex-Client-Identifier': clientIdentifier(),
    ...extra,
  };
}

/** fetch() against plex.tv that names the call and keeps the underlying network error as the cause. */
async function plexFetch(what: string, url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    throw new Error(`Plex request failed: could not reach plex.tv (${what})`, { cause: err });
  }
}

export type PlexPin = {
  id: number;
  code: string;
};

export async function createPlexPin(): Promise<PlexPin> {
  const res = await plexFetch('create pin', 'https://plex.tv/api/v2/pins', {
    method: 'POST',
    headers: { ...plexHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ strong: 'true' }),
  });

  if (!res.ok) throw new Error(`Failed to create Plex pin: ${res.status}`);

  const data = (await res.json()) as { id: number; code: string };
  return { id: data.id, code: data.code };
}

export function buildPlexAuthUrl(pin: PlexPin, forwardUrl: string): string {
  const params = new URLSearchParams({
    clientID: clientIdentifier(),
    code: pin.code,
    'context[device][product]': PLEX_PRODUCT,
    forwardUrl,
  });
  return `https://app.plex.tv/auth#?${params.toString()}`;
}

/** Returns the auth token once the pin has been linked, or null if the user hasn't approved yet. */
export async function checkPlexPin(pinId: number): Promise<string | null> {
  const res = await plexFetch('check pin', `https://plex.tv/api/v2/pins/${pinId}`, {
    headers: plexHeaders(),
    cache: 'no-store',
  });

  if (!res.ok) throw new Error(`Failed to check Plex pin: ${res.status}`);

  const data = (await res.json()) as { authToken: string | null };
  return data.authToken || null;
}

/** Polls the pin a few times with a short delay — linking is near-instant but not synchronous. */
export async function waitForPlexPin(pinId: number, attempts = 6, delayMs = 700): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    const token = await checkPlexPin(pinId);
    if (token) return token;
    if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

export type PlexAccount = {
  id: number;
  uuid: string;
  username: string;
  email: string | null;
  thumb: string | null;
};

export async function getPlexAccount(authToken: string): Promise<PlexAccount> {
  const res = await plexFetch('account', 'https://plex.tv/users/account.json', {
    headers: plexHeaders({ 'X-Plex-Token': authToken }),
    cache: 'no-store',
  });

  if (!res.ok) throw new Error(`Failed to verify Plex token: ${res.status}`);

  const data = (await res.json()) as Record<string, unknown>;
  const user = (data.user ?? data) as Record<string, unknown>;

  return {
    id: Number(user.id),
    uuid: String(user.uuid ?? ''),
    username: String(user.username ?? user.title ?? ''),
    email: (user.email as string) ?? null,
    thumb: (user.thumb as string) ?? null,
  };
}

// One entry of plex.tv's /api/v2/resources — the devices and servers linked to an account.
export type PlexResource = {
  name?: string;
  provides?: string; // comma-separated, e.g. "server" or "client,player"
  owned?: boolean;
};

/**
 * True when the list contains a Plex Media Server the account itself owns: `owned` is
 * exactly true and `provides` includes "server". Pure — unit-tested in
 * tests/plexResources.test.mjs. Servers merely shared with the account have owned false.
 */
export function hasOwnedServer(resources: unknown): boolean {
  if (!Array.isArray(resources)) return false;
  return resources.some((r) => {
    if (typeof r !== 'object' || r === null) return false;
    const { owned, provides } = r as PlexResource;
    if (owned !== true || typeof provides !== 'string') return false;
    return provides
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .includes('server');
  });
}

/**
 * Asks plex.tv, with the signing-in user's own token, whether their account owns a Plex
 * Media Server. Used only to back the owner fallback in sign-in (see matchSentinelUser):
 * Sentinel stores the server owner under a server-local id, so the owner cannot be
 * matched by plex.tv account id.
 */
export async function ownsPlexServer(authToken: string): Promise<boolean> {
  const res = await plexFetch('resources', 'https://plex.tv/api/v2/resources?includeHttps=1', {
    headers: plexHeaders({ 'X-Plex-Token': authToken }),
    cache: 'no-store',
  });

  if (!res.ok) throw new Error(`Failed to list Plex resources: ${res.status}`);

  return hasOwnedServer(await res.json());
}
