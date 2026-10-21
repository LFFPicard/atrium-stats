# AUDIT_REPORT.md — Second audit (October 2026)

**Supersedes** the July read-only audit of Batches 1–5 (still in git history at `12c84d4`).
Unlike that one, this audit **did fix what it could**. Everything below says whether it was
fixed, already resolved elsewhere, or is still open, and how each fix was verified.

**Method:** full read of `src/`, cross-checked against Sentinel's current source
(`shared/src/schema.ts`, `api/src/routes/*`, `collector/src/*`). Findings were tested live
against a fresh `next build` + `next start`, with a mock Sentinel server that logs every
request path it receives (kept in the session scratchpad, never in the repo). Admin and
regular-user sessions were inserted directly into SQLite. As before, **this still doesn't
test the real Plex login** (see Open #1).

**Bottom line:** the July audit missed a **critical** hole in the Sentinel proxy that let any
signed-in user read admin-only data. It's now fixed, verified live, and covered by the
project's first automated tests. What's left is mainly real-world verification (Plex
OAuth), one Sentinel-side correctness bug (timezones), and small features.

---

## Fixed in this pass

### 1. CRITICAL — Path traversal through the Sentinel proxy (fixed)

**What was wrong.** `app/api/sentinel/[...path]/route.ts` checked access on the catch-all
segments, then rebuilt the upstream URL with `path.join('/')`. Next.js passes catch-all
params **already URL-decoded**, so `/api/sentinel/metadata/..%2Fhistory` arrives as
`['metadata', '../history']`:

- `classify()` saw `metadata` with 2 segments and returned the `'any'` tier.
- The proxy built `/v1/metadata/../history`.
- `fetch()` normalised that to **`/v1/history`**.

The full query string was also forwarded verbatim.

**Live result before the fix, as a regular (non-admin) user:**

| Request | Sentinel received |
|---|---|
| `metadata/..%2Fhistory` | `/v1/history` — full server history incl. IPs |
| `metadata/..%2Fstats%2Fleaderboard` | `/v1/stats/leaderboard` — every user's real numbers |
| `artwork/..%2Fusers` | `/v1/users` |
| `metadata/%2E%2E%2Fgeo%2F1.2.3.4` | `/v1/geo/1.2.3.4` |

The read-tier key limited this to read access. It still broke the app's two core privacy
promises: the admin/user tier boundary and leaderboard anonymity. The July audit missed it
because it only tried encoded traversal against the leaderboard path itself, never
tunnelled through an `'any'`-tier prefix.

**Fix.**
- The rules moved to `src/lib/sentinel/proxyRules.ts`, a pure module with no Next/session
  imports.
- Every variable segment is validated against a strict shape before anything is rebuilt:
  - rating keys and user ids must match `^\d+$`;
  - `geo` must pass `net.isIP()`.
- Segments are also `encodeURIComponent`-ed when the path is rebuilt, as a second,
  independent guard.
- Query strings are now filtered against a per-route allow-list:
  - `history`: `user_id, from, to, year, limit, offset, complete`
  - `stats/*`: `year, period`
  - `artwork`: `type`
  - every other route: no params.

**Verified live after the fix.** All five traversal variants → `404`, and the mock received
nothing. Legitimate traffic was unaffected:
- user: own stats, metadata, artwork;
- admin: history with filters, geo, users/:id, server stats;
- unlisted query params (e.g. `user_id=1` on `stats/user/2`, `evil=1` on history) were
  stripped before reaching Sentinel.

**Tests.** `tests/proxyRules.test.mjs` uses Node's built-in runner, importing the TypeScript
module directly via Node 24's type stripping, so no new dependencies. Run with `npm test`:
**38 passing**, covering every allowed route, the traversal family, the leaderboard
exclusion and query filtering.

### 2. `SESSION_SECRET` was a dead variable (fixed — carried from July)
Removed from `docker-compose.yml` and the README. The local `.env.example` already lacked it.

### 3. Zero-cookie API requests got an HTML redirect, not JSON (fixed — carried from July)
`middleware.ts` now returns `401 {"error":"Not authenticated"}` for `/api/*`. Verified live.

### 4. `.env.example` was never committed (fixed)
The `.env*` rule in `.gitignore` excluded it, yet the README's Quick Start says to copy it.
Added `!.env.example`, so it will be included in the next commit.

### 5. Public share page leaked raw Sentinel errors (fixed)
`wrapped/share/[token]/page.tsx` used to render `SentinelError.message`, which includes
Sentinel's request path and raw response body, to anonymous visitors. It now logs the
detail server-side and shows a generic message. Verified live: forced an upstream failure,
and the response contained only the generic text, with no `/v1/` paths.

### 6. Expired sessions accumulated forever (fixed)
`getSession()` only deleted an expired row when that same cookie came back.
`createSession()` now sweeps all expired rows on each sign-in.

### 7. Stale middleware comment (fixed)
The comment now says middleware is *kept* on the Edge runtime. Next 15.5 can run Node
middleware, so the old claim that it "runs on Edge" no longer explained the design.

## Resolved elsewhere

### 8. Share links for hidden users stayed live (resolved in Sentinel)
Sentinel's `GET /v1/users/:id` now filters `hidden = false` (`api/src/routes/users.ts`).
`getUserById()` → `null` → the share page calls `notFound()`. No Atrium Stats change needed.

---

## Still open

| # | Severity | Item | Where |
|---|---|---|---|
| 1 | **Should fix** | Plex OAuth never tested against real Plex | Atrium Stats |
| 2 | **Should fix** | Hour/day stats bucketed in Postgres session TZ (likely UTC) | Sentinel |
| 3 | Minor | Share tokens can't be revoked and never expire | Atrium Stats |
| 4 | Minor | Session identity/`isAdmin` frozen for 30 days | Atrium Stats |
| 5 | Minor | Sentinel `/users/:id` returns every column (incl. `email`) | Sentinel |
| 6 | Minor | Live WS connection only opens on first admin visit | Atrium Stats |
| 7 | Note | Test coverage is just the proxy rules | Atrium Stats |

**1. Plex OAuth is unverified (unchanged from July, still the top priority).** Every test
to date has inserted session rows directly. Pin creation, the `app.plex.tv/auth` URL shape,
the 6 × 700 ms poll window, `account.json` parsing and the username fallback against real
Sentinel data all need one real end-to-end sign-in, ideally with both the owner account and
a household member.

**2. Timezone.** Sentinel computes hours with `extract(hour from to_timestamp(started_at))`
(`api/src/routes/stats.ts:161,259`), which uses the Postgres session timezone. No `TZ` is
configured anywhere in Sentinel, so this is almost certainly UTC. For a UK household, peak
hour, the heatmap and the Wrapped "Night Owl"/"Early Riser" personalities are an hour off
throughout British Summer Time. Fix in Sentinel:
- add a configured timezone (e.g. `STATS_TIMEZONE=Europe/London`);
- use `to_timestamp(...) AT TIME ZONE $tz` in every hour/day/date bucket, including
  `dailyPlayCounts` and the year boundaries.

This blocks any time-of-day achievement (see `ATRIUM-STATS-ACHIEVEMENTS-IDEA.md`).

**3. Share token lifecycle.** There's no way to revoke a link once shared, and links never
expire (a deliberate gap since Batch 5). Suggest a "Stop sharing" button on the Wrapped
outro (delete the row) and optionally a `revoked_at`/expiry column.

**4. Session staleness.** `isAdmin`, `username` and `sentinelUserId` are copied into the
session at sign-in and trusted for 30 days. If a user is hidden, merged (Sentinel's
`merge-duplicates` changes ids) or ownership changes, existing sessions don't notice.
A low-cost fix is to re-validate against Sentinel's `/users/:id` once per N minutes per
session.

**5. Over-broad Sentinel response.** `/users/:id` does `db.select()` with no column list, so
it returns `email`, `hidden` and timestamps to every read-tier consumer. Atrium Stats never
renders these, but it should be an explicit column list, like `/users` already is.

**6. Live connection warm-up.** `liveBroadcast.ts` opens Sentinel's WebSocket lazily, on the
first admin SSE subscriber. That's fine today, but any server-side feature that wants to
react to `stop` events (e.g. achievement unlock toasts) needs it started at boot.

**7. Tests.** The runner is now in place (`npm test`). Next candidates: `computeRank()` and
the opt-in rules in `lib/leaderboard.ts`, and `classifyPersonality()`. All are pure functions.

---

## Verification summary

- `npx tsc --noEmit` — clean
- `npx eslint .` — clean
- `npx next build` — compiled successfully
- `npm test` — 38/38 passing
- Live proxy attack re-run, user + admin sessions — traversal closed, legitimate routes intact
