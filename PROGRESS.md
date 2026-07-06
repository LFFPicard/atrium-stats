# PROGRESS.md — Atrium Stats build log

**Status: Batches 1–5 complete and committed. Batch 6 (newsletter) is deferred per the
brief — not started, likely a future session with a different model.**

This file exists so a different Claude session (or a different model) can pick up cleanly
without re-deriving context from the git log alone. It covers what was built, what bugs were
found and fixed along the way (not just what shipped clean), and what's worth knowing before
touching this code next. See `ATRIUM_STATS.md` for the original brief this was built against.

---

## Batch 1 — Foundation, auth, Sentinel client, artwork proxy

**Commit:** `a064c46`

Scaffolded the Next.js 15 App Router project matching Atrium's conventions exactly (Tailwind
v4, strict TypeScript, Server Components by default, Docker/compose, GPL-3.0). Built:

- `lib/sentinel/` — the server-only Sentinel API client (`client.ts`, `history.ts`, `stats.ts`,
  `geo.ts`, `live.ts`). The read API key lives nowhere else.
- Plex OAuth via the PIN-based device-linking flow (`lib/auth/plex.ts`) — Plex has no classic
  redirect-with-code OAuth2, so this follows the same pattern Overseerr/Tautulli use.
- DB-backed sessions (`lib/auth/session.ts`), with the documented fallback to username
  matching for Tautulli-imported users `syncUsers` hasn't reconciled to a real `plexId` yet.
- `app/api/sentinel/[...path]/route.ts` — a generic proxy so client components never call
  Sentinel directly, enforcing the admin/user tier boundary via an **explicit allow-list**
  (unrecognized paths are rejected, not silently forwarded).
- Theme system ported from Atrium with a new **Sentinel Violet** default, colors sampled
  directly from Sentinel's own admin UI (`api/admin/tailwind.config.ts`) for visual
  consistency across the ecosystem.

**Sentinel-side change:** added `GET /v1/artwork/:ratingKey` (`api/src/routes/artwork.ts`) —
fetches the image from Plex server-side using Sentinel's stored `plex_url`/`plex_token` and
streams it back, so an externally-exposed app never sees the token or internal URL.

**Caught during build:** none — this batch was mostly scaffolding, verified with
`tsc`/`eslint`/`next build` plus a live smoke test (`/login` 200, `/` redirects correctly).

**Worth knowing:** theme switching (the admin Settings page for picking a preset / overriding
colors) is **not built** — the app is hardcoded to Sentinel Violet. The theme system itself
(`lib/themes.ts`, `themeToCSS`) is fully ported and ready for that UI whenever it's built.

---

## Batch 2 — Admin dashboard: live activity, history, users, libraries

**Commit:** `ca57a7a`

- **Live Activity** — real-time session cards (poster, user, player, transcode badge,
  progress bar). Does **not** connect to Sentinel's WebSocket from the browser — that
  endpoint authenticates via the read key as a query param, which must never reach the
  client. Instead `lib/sentinel/liveBroadcast.ts` holds one persistent server-side connection
  and `app/api/sentinel/live/route.ts` re-broadcasts it as same-origin Server-Sent Events.
- **History** — full server-wide table, filterable by user/completion, paginated; IP click
  opens a geolocation lookup modal.
- **Users** — sorted by play count, click through to a per-user detail page.
- **Libraries** — name/type/item-count table.

**Bug caught during verification (not just typecheck):** the SSE route threw an uncaught
error inside the `ReadableStream` constructor when Sentinel wasn't configured, instead of
failing cleanly. Found by deliberately testing the unconfigured case, not by code review.
Fixed by checking `sentinelConfigured()` up front and returning a proper 503.

**Sentinel-side changes** (same pattern each time — found while wiring the client up, fixed
because they were small and additive):
- `GET /v1/history` wasn't selecting `ip_address` at all, despite the column existing and the
  IP lookup modal needing it. Added it to the select in `api/src/routes/history.ts`.

---

## Batch 3 — Server stats and graphs

**Commit:** `b4855e3`

New `/dashboard/stats` page on `GET /v1/stats/server`, with a period filter (7d/30d/90d/365d/
all) as URL state. Loaded the **dataviz skill** before writing any chart code (this is
exactly the case it's for) and used it deliberately rather than eyeballing colors:

- **ActivityChart** — daily play count line chart, single series in the app's own accent
  violet (a lone series needs no legend per the skill).
- **Heatmap** — day-of-week × hour grid. Recharts has no heatmap primitive, so this is a
  hand-built HTML/CSS grid with a proper one-hue sequential ramp (alpha-blended accent
  violet), hover/focus readout, and a less→more legend.
- **LibraryBreakdown** — donut chart, categorical colors pulled from the dataviz skill's
  already-validated 8-hue set, checked with `scripts/validate_palette.js` against the app's
  actual dark surface color.

**Bug caught via an actual mock-data smoke test, not typecheck:** built a small mock Sentinel
server with realistic sample data and hit the live page with it. Found that the library
breakdown color/label map was keyed on `movie/show/music/photo` (library section type) —
but `/v1/stats/server`'s `libraryBreakdown` actually groups by `metadata.type`
(`movie/episode/track`, the per-item Plex media type). Fixed the mapping before committing.
No Sentinel-side fix needed — the assumption was wrong on the Atrium Stats side, not a
Sentinel bug.

---

## Batch 4 — Personal stats and leaderboard

**Commit:** `144310f`

- **My Stats** (`/me`) rebuilt on `GET /v1/stats/user/:id`, reusing Batch 3's Heatmap and
  TopContent components at the per-user scope. `genreBreakdown` is deliberately **not
  rendered** — it's always `[]` since Sentinel's `genres` column doesn't exist yet (see
  Known Gotchas below).
- **Leaderboard** (`/me/leaderboard`) — a genuine **two-tier opt-in system**, backed by the
  `leaderboard_opt_in` table that was already scaffolded in Batch 1:
  - `optedIn` — whether you're ranked/counted at all. Off by default. A user who hasn't
    opted in is invisible to the leaderboard entirely — never appears as a neighbor, never
    counts toward "of N".
  - `fullyPublic` — a second, independent opt-in that only matters on top of the first:
    whether neighbors see your actual name instead of "Rank N".

**The real design problem this batch solved:** Sentinel had no leaderboard endpoint. The
naive fix (call `stats/user/:id` once per user) is an N+1 pattern that scales badly; exposing
a multi-user endpoint through the existing client-facing proxy would let any regular user
inspect network responses and see **everyone's** raw play counts, breaking the "a user can
never see another user's data" rule. Solved by adding `GET /v1/stats/leaderboard` to Sentinel
(one indexed query) but **deliberately keeping it off the `/api/sentinel` proxy's allow-list**
— the leaderboard page computes rank and anonymizes neighbors entirely in a Server Component,
so raw multi-user data never reaches the browser.

**Bug caught while writing the code, before it ran:** the first draft of `setOptedIn()` used
a ternary that resolved to `undefined` for the "leave this column alone" case in a Drizzle
`.set()` call — which doesn't reliably mean "don't touch this column" across drivers, and
could have silently NULLed `fullyPublic`. Rewrote with explicit branches instead of relying
on `undefined` semantics.

**Verified beyond typecheck:** stood up a mock Sentinel server with four simulated users and
drove the actual opt-in/fully-public toggle flow across two different real sessions
(testadmin and bob) — confirmed bob only sees testadmin's real name once both have opted in
**and** testadmin separately turned on full visibility. This is the kind of cross-user
privacy bug that never shows up in a type-checker.

**Sentinel-side change:** added `GET /v1/stats/leaderboard` (`api/src/routes/stats.ts`,
reusing the existing `parseTimeParams`/`buildConditions` helpers) — returns every non-hidden
user's real totals for a period. **This endpoint returns everyone's real numbers and must
never be exposed to a browser** — comment left in both `stats.ts` and the proxy's
`classify()` function explaining why no rule exists for it there.

**Refactor along the way:** `Sidebar` was hardcoding the admin nav array; generalized it to
take `navItems` as a prop so the new user-tier shell (`components/me/MeShell.tsx`) reuses the
same Sidebar/Topbar instead of duplicating ~130 lines of shell markup for a different nav set.

---

## Batch 5 — Wrapped slideshow and sharing

**Commit:** `dc2bd83`

- **Year selector** (`/wrapped`) — a card per recent year with a real play-count teaser,
  fetched in parallel per candidate year.
- **Slideshow** (`/wrapped/[year]`) — Intro → Top Show → Top Movie → Peak Time → Heatmap
  (reusing Batch 3's component) → Personality → Leaderboard Rank (only if opted in) → Outro.
  Framer Motion crossfades, Stories-style navigation (tap zones, arrow keys, clickable
  progress dots), blurred poster/art as an ambient background per slide via the artwork
  proxy.
- **Personality classification** (`lib/stats/personality.ts`) — a ranked read of peak hour,
  weekend-vs-weekday split (from the heatmap), and total volume. Genre variety is
  deliberately **not** a signal — same reason as Batch 4's omission.
- **Share links** — a token in the `share_tokens` table (scaffolded in Batch 1) resolves to a
  fully public `/wrapped/share/[token]` route, no session required.

**Two real bugs caught while building, not after:**
1. Nesting the ambient backdrop inside each Framer-Motion-animated slide broke full-viewport
   coverage — an animated CSS `transform` makes an element a containing block for any
   `fixed`-positioned descendant, so the backdrop was getting boxed into the slide instead of
   covering the screen. Fixed by hoisting `BlurredBackdrop` to be a sibling of the animated
   content in `SlideShow.tsx`, not nested inside it.
2. The Stories-style full-bleed tap-to-navigate overlay was silently swallowing clicks on the
   Heatmap slide — Heatmap's cells rely on real hover/focus events for their tooltip readout,
   but the parent slide wrapper is `pointer-events-none` by design (so taps fall through to
   the nav zones). Fixed with a targeted `pointer-events-auto` on that slide's content only.

**The privacy-critical design decision:** a share link can leave the trusted app entirely (it
can be posted anywhere), so the leaderboard slide and share button are **never assembled at
all** for a public share — not just hidden in the UI. `lib/stats/wrapped.ts`'s
`includeLeaderboard` flag controls this at the data-assembly layer, called with `false` for
every public share request.

**Verified for real, not just trusted:** created a share link for a user who **is** opted
into and ranked on the leaderboard, then fetched that exact share URL with **zero cookies**
and confirmed the response has no rank data and no share button, while the real Wrapped
content (top show, top movie, personality) renders correctly. This is the one test that
actually mattered for this batch.

**Refactor along the way:** extracted the "filter to opted-in users, compute rank" rule out
of `/me/leaderboard`'s page component into `lib/leaderboard.ts`'s `computeRank()`, so
Wrapped's leaderboard slide reuses the exact same rule instead of a second copy that could
drift from the first.

---

## Sentinel-side changes made across all five batches

All of these were found while wiring up the corresponding Atrium Stats feature, are small and
additive, and are documented in Sentinel's own `SENTINEL.md` under Known Gotchas:

| Change | File | Found in |
|---|---|---|
| Added `GET /v1/artwork/:ratingKey` | `api/src/routes/artwork.ts` (new) | Batch 1 |
| `GET /v1/history` wasn't selecting `ip_address` | `api/src/routes/history.ts` | Batch 2 |
| `queryLiveSessions()` wasn't selecting `metadata.duration` | `api/src/ws/listener.ts` | Batch 2 |
| Top-content selects exposed `metadataId` (internal id) instead of `ratingKey` for artwork linking | `api/src/routes/stats.ts` | Batch 2 |
| Added `GET /v1/stats/leaderboard` | `api/src/routes/stats.ts` | Batch 4 |

**None of these are committed in the Sentinel repo.** Its working tree already had a large
amount of unrelated pre-existing uncommitted work (collector changes, admin UI client
changes, a few new route files) from before this session started — that isn't this session's
work to fold into a commit, so it was left alone and flagged instead of guessed at. If you
pick this up next: the Sentinel changes above are real, tested (`tsc --noEmit` clean each
time), and safe to commit on their own — just isolate them from the rest of the working tree
first.

---

## Known gaps / deliberately deferred

- **Batch 6 (newsletter)** — not started at all, per the brief.
- **Admin Settings page** — no UI yet for switching theme presets, overriding colors, editing
  the Sentinel connection, or leaderboard defaults. The app is hardcoded to Sentinel Violet
  and reads Sentinel connection details from env vars only. `lib/themes.ts` is ready for this
  whenever it's built.
- **Genre-based features** — omitted everywhere (My Stats, Wrapped personality) because
  Sentinel's `genres` column doesn't exist yet. Once it does, the Known Gotchas section in
  `ATRIUM_STATS.md` already flags where this UI should go back in.
- **Discover categories** ("Weekend Warriors", "Night Owl Club", etc.) — explicitly a
  nice-to-have in the brief, not built. Batch 5's personality classifier computes similar
  signals (peak hour, weekend-heaviness) for one user at a time; a real Discover feature
  would need this computed server-wide, which is a different (and heavier) query shape.
- **Share link expiry** — share tokens never expire. Not required by the brief, but worth
  deciding on purpose later rather than by default.
- **Leaderboard scale** — `GET /v1/stats/leaderboard` runs one query for every non-hidden
  user with plays in scope. Fine at homelab scale (tens to low hundreds of users, matching
  Sentinel's real dataset per its own docs); would need pagination or caching well before it
  became a real install's bottleneck.
