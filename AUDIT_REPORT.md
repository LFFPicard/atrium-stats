# AUDIT_REPORT.md — Read-only audit of Batches 1–5

**Scope:** Complete, read-only audit of everything built across Batches 1–5. No code was
modified as part of this audit — every finding below is a report only. Cross-checked against
a fresh reading of `ATRIUM_STATS.md`, `PROGRESS.md`, and Sentinel's `SENTINEL.md`, plus live
testing against a mock Sentinel server (built for this audit, never touching the real
ecosystem) with two real HTTP sessions: one admin, one regular user.

**Bottom line:** No critical vulnerabilities found. The admin/user tier boundary, the
leaderboard's two-tier opt-in, and the Wrapped share-link privacy design all held up under
active adversarial testing (path traversal, casing/encoding bypass attempts, user-ID
manipulation, request-body field smuggling) — not just code review. The two things worth
real attention before this goes in front of real users are the dead `SESSION_SECRET`
variable and, more importantly, **the Plex OAuth login flow has never been exercised against
real Plex** — every test this session, including this audit, has authenticated by inserting
rows directly into the `sessions` table.

---

## 1. Cross-batch consistency

**Note — clean, no findings.**

Re-read every consuming file against a fresh read of the actual current state of each
function/type it depends on (not memory of what was written): `lib/sentinel/client.ts`,
`history.ts`, `stats.ts`, `geo.ts`, `live.ts`, `liveBroadcast.ts`, `lib/leaderboard.ts`,
`lib/stats/wrapped.ts`, `lib/stats/personality.ts`, the proxy route, both auth routes, both
leaderboard toggle routes, the share-token route, and every page/component under
`app/dashboard`, `app/me`, and `app/wrapped`.

Specifically checked for the exact failure mode the task described — a later batch trusting
an earlier batch's shape without re-verifying:

- `UserStats.topShows` (Batch 4/5 consumer) vs. the actual `/stats/user/:userId` route: the
  route's topShows select does **not** add a `grandparentTitle` mirror field the way
  `/stats/server`'s does — and the `UserStats` type correctly omits it (typed as plain
  `TopContentItem[]`), while `ServerStats.topShows` correctly types the extra field. This is
  right, not a bug — flagging it because it's exactly the kind of easy-to-miss asymmetry the
  task asked about, and it turned out to already be handled correctly.
- `TopContentItem.ratingKey` (added mid-session, Batch 2) — reused correctly in Batch 3
  (admin stats), Batch 4 (user detail, My Stats), and Batch 5 (Wrapped slides) without any
  stale reference to the old `metadataId`-for-artwork assumption anywhere.
- `LiveMedia.duration` (added mid-session, Batch 2) — `LiveActivity.tsx`'s progress-bar math
  correctly guards on `session.media?.duration` being present before computing a percentage;
  no code path assumes it unconditionally.
- The leaderboard ranking rule (opt-in filter + index lookup) — verified there are only two
  call sites in the entire codebase (`app/me/leaderboard/page.tsx` and
  `lib/stats/wrapped.ts`), both routed through the same `computeRank()` helper extracted in
  Batch 5. No second, drifted copy of the rule exists anywhere.

---

## 2. Environment & configuration completeness

**Should Fix:** `SESSION_SECRET` is declared in both `.env.example` and `docker-compose.yml`
with a description implying it matters ("Random string used to sign session tokens"), but
`grep`-ing the entire `src/` tree and `scripts/` for `SESSION_SECRET` finds **zero
references**. Sessions are opaque random tokens (`randomBytes(32).toString('hex')`) stored
server-side in SQLite, not signed JWTs — nothing in the actual session implementation
(`lib/auth/session.ts`) ever reads or uses a secret. Right now, setting this variable to
anything (including leaving it as the placeholder) has literally no effect. Either wire it in
as a real defense-in-depth measure (e.g., HMAC-signing the cookie value in addition to the DB
lookup) or remove it from `.env.example`/`docker-compose.yml` so it stops implying a security
property that doesn't exist.

**Note — everything else is clean.** Full inventory of every `process.env.*` reference in
`src/`:

| Variable | Used in | In `.env.example`? | In `docker-compose.yml`? |
|---|---|---|---|
| `APP_URL` | 6 files (auth routes, leaderboard routes, share route) | ✅ | ✅ |
| `DATABASE_URL` | `lib/db/index.ts`, `scripts/migrate.mjs`, `drizzle.config.ts` | ✅ | ✅ |
| `SENTINEL_URL` | `lib/sentinel/client.ts`, `lib/sentinel/live.ts` | ✅ | ✅ |
| `SENTINEL_API_KEY` | `lib/sentinel/client.ts`, `lib/sentinel/live.ts` | ✅ | ✅ |
| `PLEX_CLIENT_IDENTIFIER` | `lib/auth/plex.ts` | ✅ | ✅ |
| `NODE_ENV` | `lib/auth/session.ts`, `app/api/auth/plex/route.ts` (cookie `secure` flag) | N/A — standard Next.js var, not user-set | N/A |
| `SESSION_SECRET` | **nowhere** | ✅ (dead) | ✅ (dead) |

`docker-compose.yml` and `.env.example` list an identical set of variables with matching
placeholder values — no drift between the two files. The `Dockerfile` declares no `ENV`/`ARG`
of its own (relies entirely on `docker-compose.yml`'s `environment:` block), consistent with
Atrium's own Dockerfile pattern. `drizzle.config.ts` uses a non-null assertion
(`process.env.DATABASE_URL!`) — fine for its actual usage (a dev-time-only CLI tool run by a
developer, not part of the deployed app), but would throw an unhelpful "undefined" TypeError
if someone ran `drizzle-kit generate` without `DATABASE_URL` set locally. Not user-facing;
not flagging as more than this note.

---

## 3. Sentinel response shape verification

**Note — clean, no findings.** Read every actual current Sentinel route handler (not
`SENTINEL.md`'s prose description) fresh: `history.ts`, all three routes in `stats.ts`
(`/stats/server`, `/stats/user/:userId`, `/stats/leaderboard`), `users.ts`, `geo.ts`,
`libraries.ts`, `metadata.ts`, `artwork.ts`, and `ws/listener.ts`'s `queryLiveSessions()`.
Compared field-by-field against every corresponding type in `lib/sentinel/*.ts`.

Everything matches exactly, including the three routes that were edited mid-session:

- `history.ts`'s select now includes `ipAddress: sessionHistory.ipAddress` — matches
  `HistoryEntry.ipAddress` in `lib/sentinel/history.ts` exactly.
- All four top-content selects in `stats.ts` (server×2, user×2) now include
  `ratingKey` — matches `TopContentItem.ratingKey` exactly, and the server-stats route's
  post-query `.map()` correctly carries `row.ratingKey` through into the response (verified
  the map isn't accidentally dropping the new field, since that's exactly the kind of thing
  a `.map()` transform can silently do).
- `queryLiveSessions()`'s `media` object now includes `duration: metadata.duration` — matches
  `LiveMedia.duration` in `lib/sentinel/live.ts` exactly, and affects both
  `GET /v1/sessions/live` and every `/ws/live` broadcast event identically (same shared query
  function), which the Atrium Stats client type correctly doesn't distinguish between.
- `/stats/leaderboard`'s response shape (`{ leaderboard: [{userId, username, displayName,
  totalPlays, totalHours}] }`) matches `LeaderboardEntry` in `lib/sentinel/stats.ts` exactly.

One pre-existing (not introduced this session) documentation/implementation mismatch, noted
for completeness rather than as a new finding: `SENTINEL.md`'s REST API section documents a
`?library_type=` query param on `GET /v1/history`, but the actual route implementation never
reads or applies it. Atrium Stats' `getHistory()` correctly never sends this param either, so
there's no bug on the Atrium Stats side — just a doc/code drift on Sentinel's side that
predates this session.

---

## 4. Full build verification

**Note — clean.** Ran fresh (not relying on any per-batch result recorded earlier):

- `npx tsc --noEmit` — zero errors.
- `npx eslint .` — zero errors, zero warnings.
- `rm -rf .next && npx next build` — compiled successfully, all 20 routes
  (8 API routes, 12 pages) built without error, including the two dynamic Wrapped routes and
  the SSE/proxy routes.

---

## 5. SECURITY — admin/user tier boundary

**This section was tested live against a running instance, not just read from source.** Set
up a mock Sentinel server serving distinguishable per-user data, two real app sessions (one
`isAdmin: true`, one `isAdmin: false`) inserted into the local SQLite `sessions` table, and
attacked the proxy and leaderboard routes directly with `curl`.

**Note — `stats/leaderboard` is genuinely unreachable, confirmed live, for both tiers.**
Requested `/api/sentinel/stats/leaderboard` as the regular-user session → `404 {"error":"Not
found"}`. Requested the same path as the **admin** session → also `404`. This confirms the
route is structurally absent from the allow-list (`classify()` returns `null` unconditionally
for this path), not merely gated behind an `isAdmin` check that a config error could flip
permissive — the distinction the task asked me to specifically verify.

**Note — path traversal / casing / encoding / trailing-slash bypass attempts: all blocked.**
Tried, as the regular-user session, against `/api/sentinel/stats/leaderboard`:

| Attempt | Result |
|---|---|
| `../stats/leaderboard` | Client-normalized before send; lands on Next's own 404 (route doesn't exist at that path) |
| `STATS/LEADERBOARD`, `Stats/Leaderboard` | `404` — `classify()` uses strict `===`, case-sensitive |
| `stats/leaderboard/` (trailing slash) | `308` → redirects to the canonical path → `404` when followed |
| `stats%2Fleaderboard` (encoded slash) | `404` — not decoded into an extra matching segment |
| `stats/leaderboard%20` (encoded trailing space) | `404` — decoded segment `"leaderboard "` ≠ `"leaderboard"` |
| `%2e%2e/stats/leaderboard` | Normalized before send, same as `../` case |
| `stats//leaderboard` (double slash) | `308` → redirects to canonical path → `404` when followed |
| `./stats/leaderboard` | `404` |
| `users/../stats/leaderboard` | Normalized to the canonical path → `404` |

No variant reached a permissive result anywhere.

**Note — user-ID manipulation: blocked, confirmed with several encodings.** As the
regular-user session (Sentinel user id `2`):

- `GET /api/sentinel/stats/user/1` (someone else's ID) → `403 Forbidden`.
- `GET /api/sentinel/stats/user/2` (own ID) → `200`, correct own data returned.
- Tried `02`, `" 2"`, `"2 "`, `2.0`, `0x2`, `2%00`, `2/../1` as the ID — every single variant
  → `403`. The proxy's check (`requestedId !== String(session.sentinelUserId)`) is a strict
  string comparison with no normalization on either side, so none of the usual "equivalent
  but not identical" tricks apply.

**Note — leaderboard opt-in/fully-public routes: confirmed the request body can't target
another user.** POSTed to `/api/leaderboard/opt-in` as the regular-user session with a body
of `value=true&sentinelUserId=1&userId=1` (attempting to smuggle admin's user ID alongside
the real toggle value). Inspected the SQLite `leaderboard_opt_in` table directly afterward:
the row that changed was `sentinel_user_id: 2` (the actual session owner) — admin's row
(`sentinel_user_id: 1`) was untouched. The route only ever reads `session.sentinelUserId`;
the extra body fields are never even parsed, let alone trusted.

**Note — `metadata`/`artwork` ('any'-tier) routes confirmed reachable for non-admin
sessions**, and the SSE `/api/sentinel/live` route confirmed `403` for the regular-user
session and confirmed reachable (long-lived connection, not immediately rejected) for the
admin session.

**Minor — unauthenticated (zero-cookie) requests get an HTML redirect, not a JSON 401.**
Requesting any `/api/sentinel/*` path with literally no session cookie returns a `307`
redirect to `/login` (from `middleware.ts`'s cookie-presence check) rather than reaching the
route handler's own `if (!session) return 401` JSON response at all — that check only
becomes reachable once a cookie is *present* but fails the DB lookup (confirmed separately: a
garbage cookie value → correctly returns `401 {"error":"Not authenticated"}` in JSON). This
is not a security bypass — no data is exposed in either case, and the eventual redirect
target (`/login`) requires no auth itself — but it's an inconsistent API contract for any
future fetch-based client that expects a JSON error rather than an HTML redirect body when it
sends no cookie at all.

---

## 6. Wrapped share link privacy — independently re-verified

**Note — re-confirmed, more exhaustively than the Batch 5 test PROGRESS.md describes.**
Generated a fresh share token for the admin test user, who is opted into the leaderboard,
set to fully-public, **and** ranked (2 total users in this test's leaderboard). Fetched that
exact share URL with **zero cookies** and captured the complete raw response body — not just
the visually-rendered HTML, but the embedded React Server Components flight/JSON payload
that Next.js streams alongside it (which is where a "hidden but still present in the DOM"
leak would actually show up, since RSC payloads carry the full prop tree passed to every
client component whether or not it's visually rendered).

Searched that complete response for any of: `leaderboard`, `Rank`, `Share my Wrapped`,
`ShareButton`, `ranked`, `ownStats` — **zero matches, case-insensitive, anywhere in the
response.** As a positive control (to rule out a broken page producing a false-negative),
confirmed the actual Wrapped content — username, top movie, top show, personality
classification — rendered correctly in the same response.

Also checked the response headers for anything the earlier test didn't cover:
`Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` — confirms no
shared/CDN cache sits between a visitor and this route in a way that could serve one user's
cached Wrapped payload to a different visitor of a similarly-shaped URL.

---

## 7. Sentinel-side impact check — admin UI

**Note — clean, confirmed by reading the full endpoint inventory, not by inspection of a few
likely pages.** Read every file under `api/admin/src/pages/` and the complete list of
endpoints `api/admin/src/api/client.ts` calls:

```
/v1/status, /v1/admin/settings, /v1/admin/api-keys, /v1/admin/import/status,
/v1/admin/import/tautulli, /v1/users, /v1/admin/users/:id, /v1/admin/users/:id/purge,
/v1/admin/users/merge-duplicates, /v1/admin/library-sync(/status), /v1/libraries,
/v1/admin/libraries/:id, /v1/admin/maintenance/status, /v1/admin/maintenance/vacuum,
/v1/admin/history, /v1/admin/logs, /v1/admin/reset
```

Zero calls to `/v1/stats/*`, `/v1/sessions/live`, `/ws/live`, or `/v1/artwork/*` anywhere in
the admin UI. Every field this session added to Sentinel (`ratingKey` in the stats
top-content selects, `duration` in `queryLiveSessions()`, `ipAddress` in history, the new
artwork and leaderboard routes) is on a code path the admin UI never touches. There is no
admin UI page called "Stats" at all (confirmed against `SENTINEL.md`'s own documented page
list) — the admin UI's only `/v1/users` call is the plain list endpoint for the Users
management table, which was never modified.

---

## 8. Real-world auth flow — **UNVERIFIED, flagging clearly as requested**

**Should Fix (highest non-security priority in this report).** The Plex OAuth PIN-based
device-linking flow — `createPlexPin()` → redirect to `app.plex.tv/auth` → user approves →
Plex forwards to `/api/auth/callback` → `waitForPlexPin()` polls → `getPlexAccount()` verifies
the token → `findSentinelUser()` matches against Sentinel — **has never been exercised
against real Plex, at any point in this project, including during this audit.**

Every single test performed across all five batches and this audit authenticated by
inserting a row directly into the local `sessions` table via a Node script, bypassing
`/api/auth/plex`, `/api/auth/callback`, and everything in `lib/auth/plex.ts` entirely. This
means the following have **zero real-world confirmation**:

- That `POST https://plex.tv/api/v2/pins` actually returns `{ id, code }` in the shape
  `createPlexPin()` assumes.
- That the constructed `app.plex.tv/auth#?clientID=...&code=...&forwardUrl=...` URL is
  currently correct — Plex's own auth UI has changed shape before.
- That `waitForPlexPin()`'s 6 attempts × 700ms is actually sufficient real-world timing
  between a user approving in the Plex UI and the pin resolving.
- That `GET https://plex.tv/users/account.json`'s response shape matches the
  `data.user ?? data` fallback `getPlexAccount()` guesses at.
- That `findSentinelUser()`'s exact-`plexId`-then-username-fallback logic actually reconciles
  correctly against a **real** Sentinel `/v1/users` dataset (this was designed against the
  documented edge case in `ATRIUM_STATS.md`, but never run against real data).

This is the literal first thing every real user does. Recommend a real end-to-end test
against a live Plex account and a live Sentinel instance before this goes in front of anyone
other than the developer, independent of anything else in this report.

---

## 9. Dead code / cleanup

**Note — clean.** `git status --short` shows a clean working tree (no uncommitted changes).
Reviewed the complete `git ls-files` output — no mock servers, test fixtures, or debug
scaffolding anywhere in the tracked file tree. Every mock Sentinel server used for
verification during Batches 1–5 and this audit was written to the session's scratchpad
directory, entirely outside the repository, and was never at risk of being committed.

---

## 10. Anything else

**Minor:** Sentinel's `GET /v1/users/:id` does not filter on the `hidden` flag — only the
list endpoint (`GET /v1/users`) does. This means a Wrapped share link generated for a user
*before* an admin hides/soft-deletes them will continue to resolve and display that user's
Wrapped data indefinitely afterward, since `getUserById()` (used by the public share page)
calls the single-user endpoint. This is pre-existing Sentinel behavior, not introduced this
session, but it interacts directly with Batch 5's share-link feature and is worth a decision
(either Sentinel's single-user endpoint should also respect `hidden`, or Atrium Stats'
share-token cleanup should be tied to user purge/hide events).

**Note:** No SSRF vector in the proxy — `sentinelFetchRaw()` always targets the fixed,
server-configured `SENTINEL_URL` as a base; client-supplied path segments can only ever
become the path suffix, never redirect the request to a different host.

**Note:** `middleware.ts`'s public-path check for `/wrapped/share` uses `startsWith`, which
is intentionally broad (covers any future sub-path under it) — confirmed this doesn't
accidentally over-match any other real route, since no other route begins with that prefix.

**Note:** Share tokens never expire (already documented as a known, deliberate gap in
`PROGRESS.md` — re-confirmed still true, not a new finding).

---

## Summary table

| # | Area | Severity | Finding |
|---|---|---|---|
| 8 | Auth flow | **Should Fix** | Plex OAuth never tested against real Plex — highest-priority remaining verification gap |
| 2 | Env config | **Should Fix** | `SESSION_SECRET` declared but completely unused — misleading, should be wired in or removed |
| 5 | Security | Minor | Zero-cookie proxy requests get an HTML redirect instead of a JSON 401 (not a bypass) |
| 10 | Other | Minor | `GET /v1/users/:id` ignores `hidden` — stale share links for hidden users stay live |
| 1, 3, 4, 5, 6, 7, 9 | — | Note | Everything else checked came back clean — see sections above for what was actually tested |

No code was changed while producing this report.
