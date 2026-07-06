# ATRIUM_STATS.md — Atrium Stats

## Project Overview

**Atrium Stats** is a self-hosted Tautulli-replacement dashboard and Spotify-Wrapped-style personal year-in-review, built entirely on top of **Sentinel's** API. It replaces Tautulli's web UI for anyone in the LFFPicard homelab ecosystem — live activity, full history, per-user and per-library statistics, graphs, IP lookups, and a personal "Wrapped" slideshow experience, all in one app.

It absorbs and supersedes the earlier "Atrium Rewind" concept — that project's global dashboard + personal Wrapped idea is now the foundation of this app, expanded to full Tautulli feature parity plus a newsletter agent.

Distributed as its own standalone Docker container with its own repo — same pattern as every other project in this ecosystem. Not a module inside Atrium (the portal). Reads Sentinel's API for all Plex data; owns a small local SQLite database only for its own concerns (sessions, leaderboard opt-in, share tokens, later: newsletter config).

**This app is meant to be externally accessible** — unlike Sentinel, which never leaves the LAN. People in the household (or wider, if the admin chooses) log in with their own Plex account and see their own stats.

---

## Relationship to the Ecosystem

```
Plex Media Server
      │
      ▼
  SENTINEL (data vault — LAN only, never exposed externally)
  ├── PostgreSQL
  ├── REST API (/v1/...)
  └── WebSocket (/ws/live)
      │
      ├──▶ Atrium           (portal — Sonarr/Radarr calendar, requests, messaging)
      └──▶ ATRIUM STATS      (this project — full stats dashboard + Wrapped)
```

Atrium Stats never talks to Plex directly. Every piece of data — history, live sessions, users, libraries, metadata, geolocation, stats aggregation — comes from Sentinel's API using a **read-tier** API key. Atrium Stats has no Plex token of its own and never needs one.

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) | Matches ecosystem standard |
| Language | TypeScript strict | Matches ecosystem standard |
| Styling | Tailwind CSS | Same CSS custom property theming approach as Atrium |
| Animations | Framer Motion | Wrapped slide transitions |
| Charts | Recharts | Consistent with the rest of the portfolio |
| Local database | SQLite via Drizzle ORM | Sessions, leaderboard opt-in, share tokens — NOT Plex data |
| Auth | Plex OAuth | Matches Sentinel's real `plex_id` directly — see Auth section |
| Container | Docker + docker-compose | Single container, one volume mount |
| Package manager | npm | |

No external hosted services. No cloud dependencies. GPL-3.0.

---

## Sentinel API Reference

Full reference — everything Atrium Stats needs is already built and verified working against real data (172,877 sessions, 133,039 metadata rows). All requests need `Authorization: Bearer sk_read_xxxxx`.

### Core data
```
GET  /v1/status                    Server info, DB counts (admin key only — not used by Atrium Stats)
GET  /v1/history                   ?user_id, ?year, ?from, ?to, ?limit, ?offset, ?complete
GET  /v1/users                     All non-hidden users with summary stats
GET  /v1/users/:id                 Single user
GET  /v1/libraries                 All libraries with record counts
GET  /v1/metadata/:ratingKey       Cached metadata + poster path for a media item
GET  /v1/sessions/live             Current active streams (also available live via WS)
GET  /v1/geo/:ip                   Cached geolocation (country, region, city, ISP)
```

### Stats aggregation
```
GET  /v1/stats/server              ?year= or ?period= (7d|30d|90d|365d|all)
GET  /v1/stats/user/:userId        ?year= or ?period=
```

`stats/server` returns: `totalPlays`, `totalHours`, `uniqueUsers`, `topMovies[]`, `topShows[]`, `dailyPlayCounts[]`, `heatmap[]` (dayOfWeek 0-6, hour 0-23), `libraryBreakdown[]`.

`stats/user/:id` returns: `totalPlays`, `totalHours`, `topShows[]`, `topMovies[]`, `genreBreakdown[]` (**currently always empty** — the `genres` column doesn't exist in Sentinel's schema yet, don't build UI that assumes this has data), `peakDay`, `peakHour`, `heatmap[]`.

**Note on `topShows`:** `metadataId` in this response is a representative episode's ID, not a show-level metadata row (Sentinel has no separate "show" metadata type — shows are grouped by `grandparent_key`). For posters, this is fine — the episode's thumb is usually close enough, or look up by `grandparent_key` against `/v1/metadata/` if you need the show's own poster specifically.

### Live WebSocket
```
ws://sentinel-host:7700/ws/live?key=sk_read_xxxxx
```
Sends a full snapshot on connect, then a message per event:
```json
{ "event": "play" | "pause" | "resume" | "stop", "session": {...}, "sessions": [...] }
```
Plus a `heartbeat` every 30s. This is genuinely real-time (Postgres LISTEN/NOTIFY under the hood, confirmed working end-to-end) — no polling needed for the live activity view.

### Artwork (to be built — see Batch 1)
```
GET  /v1/artwork/:ratingKey
```
Does not exist yet. **Sentinel currently only stores relative Plex thumb paths** (e.g. `/library/metadata/34195/thumb/...`) — displaying these requires the Plex server's own URL and token, which must never be exposed to an externally-facing app like Atrium Stats. This endpoint needs to be added to **Sentinel** (not Atrium Stats) — it fetches the image from Plex internally using Sentinel's own stored token/URL and streams the bytes back. Read-tier key sufficient. This is Batch 1 work, done with Sentinel's codebase loaded alongside this brief.

---

## Auth Architecture — Plex OAuth

1. User clicks "Sign in with Plex" on Atrium Stats
2. Redirect to Plex's OAuth flow (`app.plex.tv/auth`) — same pattern already documented in Atrium's own auth architecture, reuse it
3. Verify the returned token against `plex.tv/users/account`
4. Take the resulting Plex account ID and call Sentinel's `GET /v1/users` to find a matching `plexId`
5. Store an Atrium Stats session (its own local SQLite, not Sentinel) linking this browser session to the matched Sentinel user ID

**Known edge case to handle:** a user who has extensive Tautulli-imported history but has never had a *live* session captured by Sentinel's collector may still be sitting under a `tautulli_{user_id}` placeholder rather than their real `plexId`, if Sentinel's `syncUsers` reconciliation hasn't run against them yet (it matches by username, hourly). If no exact `plexId` match is found on login, fall back to matching by Plex username against Sentinel's `/v1/users` list before giving up and showing "no history found." Don't silently fail for these users — this is a real, expected scenario for less-active household members.

**Admin identification:** the user whose `plexId` matches Sentinel's server owner (`isOwner: true` in `/v1/users`) gets the admin view. Everyone else gets the user view. No separate admin login needed — it's determined by Plex identity.

---

## Two Tiers

### Admin view (server owner only)
Full Tautulli parity:
- **Live Activity** — real-time now-playing cards via `/ws/live`, matching Tautulli's activity page layout: poster, title, user, player/platform, transcode decision, progress bar
- **History** — full server-wide history table, all users, filterable/sortable (mirrors Tautulli's History page — Date, User, IP, Platform, Title, Started, Paused, Stopped, Duration)
- **IP lookup** — click an IP in history to see cached geo data from `/v1/geo/:ip` (country, region, city, ISP) — mirrors Tautulli's IP modal
- **Users** — list with per-user summary stats, click through to individual user history/stats
- **Libraries** — library list with item counts, type breakdown
- **Server Stats** — graphs and top content from `/v1/stats/server`: daily play line chart, heatmap, top movies/shows, library breakdown donut
- **Settings** — Sentinel connection (URL + read API key), branding/theme, leaderboard visibility defaults

### User view (everyone else)
- **My Stats** — personal history, personal graphs, personal library breakdown, sourced from `/v1/stats/user/:id` filtered to their own `user_id`
- **My Wrapped** — the annual slideshow (see Wrapped section)
- **Leaderboard** — opt-in, anonymized by default. Shows "You're #12 of 40 this month" with the two users immediately above and below shown as "Rank +1 / Rank -1" without names, unless those specific users have separately opted into full public visibility. A user never sees anyone else's personal history or IP data regardless of leaderboard opt-in.

A regular user can never query another user's detailed data through Atrium Stats — the app enforces this at the route level even though the read-tier Sentinel key technically has access to everyone's data. This boundary is Atrium Stats' responsibility, not Sentinel's.

---

## Wrapped (Personal Year-in-Review)

Same slideshow concept as the original Atrium Rewind design — full-bleed dark backgrounds, large typography, poster art as blurred ambient backgrounds, Framer Motion transitions between slides.

Slides (data all comes from `/v1/stats/user/:id?year=`):
- Intro
- Top show
- Top movie
- Peak time (day/hour)
- Heatmap
- Personality classification (derive from viewing patterns — binge frequency, genre variety once available, time-of-day consistency)
- Leaderboard placement (only if opted in)
- Outro + share button

Share links generate a public, read-only view via a token stored in Atrium Stats' own local DB — never exposes other users' data, never touches Sentinel's admin surface.

---

## Nice-to-Haves (not this session, but worth designing room for)

Spotted in a competing project (Server Portal) worth borrowing later:
- **Discover categories** computed from existing stats data: "Weekend Warriors" (weekend-heavy viewers), "Night Owl Club" (late-night viewing patterns, ties into `peakHour`), "Cult Classics" (high play-count-to-viewer-count ratio — niche titles with a devoted few), "Blast from the Past" (pre-2000 content trending recently, using `metadata.year` + recent `session_history.started_at`)
- Shareable Wrapped export as a static PNG image, as an alternative to the live share link
- "Server Rank" card showing just your position ±1 either side, rather than a full leaderboard table — already folded into the leaderboard design above

---

## Theming

Reuses Atrium's existing 3-layer theme system (presets → per-element overrides → login page customization) exactly as-is — nothing new to build here, just apply it.

**Default theme: Sentinel Violet** (matches Sentinel's admin UI palette) — this is now the ecosystem-wide default going forward, superseding Atrium Dark as the default preset. Existing presets (Atrium Dark, Plex orange, Jellyfin purple, AMOLED, Light) remain available as alternatives.

---

## Folder Structure

```
atrium-stats/
├── ATRIUM_STATS.md
├── README.md
├── LICENSE                     GPL-3.0
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── drizzle.config.ts
├── next.config.ts
├── tailwind.config.ts
│
├── data/                        Docker volume — local SQLite only
│   └── atrium-stats.db
│
└── src/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx             Redirects to /dashboard (admin) or /me (user)
    │   ├── login/
    │   │   └── page.tsx         Plex OAuth entry point
    │   ├── dashboard/            Admin only
    │   │   ├── page.tsx          Live activity + hero stats
    │   │   ├── history/page.tsx
    │   │   ├── users/page.tsx
    │   │   ├── users/[id]/page.tsx
    │   │   └── libraries/page.tsx
    │   ├── me/                   User tier
    │   │   ├── page.tsx          Personal stats
    │   │   └── leaderboard/page.tsx
    │   ├── wrapped/
    │   │   ├── page.tsx          Year selector
    │   │   ├── [year]/page.tsx   The slideshow
    │   │   └── share/[token]/page.tsx
    │   ├── settings/page.tsx     Admin only
    │   └── api/
    │       ├── auth/
    │       │   ├── plex/route.ts
    │       │   └── callback/route.ts
    │       └── sentinel/         Server-side proxy to Sentinel — client never calls Sentinel directly
    │           └── [...path]/route.ts
    │
    ├── components/
    │   ├── ui/
    │   ├── dashboard/
    │   │   ├── LiveActivity.tsx
    │   │   ├── HistoryTable.tsx
    │   │   ├── IpLookupModal.tsx
    │   │   ├── HeroMetrics.tsx
    │   │   ├── ActivityChart.tsx
    │   │   ├── Heatmap.tsx
    │   │   └── TopContent.tsx
    │   ├── leaderboard/
    │   │   └── LeaderboardCard.tsx
    │   └── wrapped/
    │       ├── SlideShow.tsx
    │       ├── slides/
    │       └── ShareButton.tsx
    │
    └── lib/
        ├── sentinel/             Sentinel API client — the only place that holds the read key
        │   ├── client.ts
        │   ├── history.ts
        │   ├── stats.ts
        │   ├── live.ts           WebSocket client wrapper
        │   └── geo.ts
        ├── stats/                Pure TS — wrapped assembly, personality classification
        ├── auth/
        │   ├── plex.ts
        │   └── session.ts
        └── db/
            ├── index.ts
            └── schema.ts         leaderboard_opt_in, share_tokens, sessions
```

**Critical pattern:** the Sentinel read API key lives only in `lib/sentinel/client.ts`, called only from server-side API routes (`app/api/sentinel/`) or Server Components. Never expose it client-side. Same discipline as Atrium's Tautulli key handling.

---

## Build Batches

This is a large build happening across a constrained time window, possibly interrupted between sessions. Each batch must leave the app in a working, committable state — never stop mid-batch in a broken condition. Commit at the end of every batch with a clear message summarizing what's done, so a different Claude session (or a different model) can pick up cleanly.

**Batch 6 (Newsletter) is explicitly out of scope for this session** — deferred to a future session, likely with a different model, once the core app exists. Do not start it even if time remains after Batch 5; use spare time to polish/harden earlier batches instead.

### Batch 1 — Foundation
- Next.js scaffold, Tailwind, folder structure above
- Sentinel API client (`lib/sentinel/`) with the read key from env
- Plex OAuth login flow, session handling, admin/user tier detection
- Local SQLite schema (Drizzle) for sessions/leaderboard-opt-in/share-tokens
- **Also: add `GET /v1/artwork/:ratingKey` to Sentinel itself** (Sentinel's codebase should be loaded alongside this brief for this part) — proxies the Plex image server-side, streams bytes, never exposes the Plex token or internal URL
- Basic app shell, theme system wired up with Sentinel Violet default
- Commit: "Batch 1 — foundation, auth, Sentinel client, artwork proxy"

### Batch 2 — Admin dashboard core
- Live Activity view via `/ws/live`
- Full History table (server-wide, filterable)
- IP lookup modal using `/v1/geo/:ip`
- Users list + individual user detail page
- Libraries list
- Commit: "Batch 2 — admin dashboard, live activity, history, users, libraries"

### Batch 3 — Stats & graphs
- Server Stats page using `/v1/stats/server`
- Daily play chart, heatmap, top content grids, library breakdown donut
- Commit: "Batch 3 — server stats and graphs"

### Batch 4 — Personal experience
- My Stats page (user tier) using `/v1/stats/user/:id`
- Leaderboard with anonymized rank ±1 display, opt-in toggle
- Commit: "Batch 4 — personal stats and leaderboard"

### Batch 5 — Wrapped
- Full slideshow, all slides, Framer Motion transitions
- Share link generation + public share route
- Commit: "Batch 5 — Wrapped slideshow and sharing"

### Batch 6 — Newsletter (DEFERRED, not this session)
- Newsletter agent: scheduled generation using `/v1/stats/*` + `plex_added_at` for recently-added content, SMTP delivery, HTML template (reference: Tautulli's own newsletter template, already in project files)
- To be picked up in a future session

---

## Known Gotchas

- **Sentinel's `genreBreakdown` is always empty right now.** The `genres` column doesn't exist in Sentinel's schema yet. Don't build UI (e.g. a genre pie chart) that assumes this has data — either omit genre-based features entirely for now, or design the component to gracefully handle an empty array without looking broken.
- **`topShows.metadataId` is episode-level, not show-level.** See Sentinel API Reference section above.
- **Never call Sentinel directly from client components.** All Sentinel calls go through Next.js API routes (`app/api/sentinel/`) so the read key stays server-side only. Same discipline as Atrium's existing Tautulli key handling.
- **The artwork proxy is a Sentinel change, not an Atrium Stats change** — don't try to work around missing artwork by having Atrium Stats construct Plex URLs itself. That would require exposing the Plex token or internal server IP externally, which is exactly what this proxy exists to prevent.
- **A user might not have a `plexId`-matched Sentinel record yet.** See the Auth Architecture section's fallback-by-username note.
- **Sentinel itself is never exposed externally.** Only Atrium Stats (and Atrium) are meant to be internet-facing. Don't design any feature that assumes a browser can reach Sentinel directly.
- **Leaderboard privacy is enforced by Atrium Stats, not Sentinel.** The read API key technically has access to every user's data — the tier boundary (user can only see their own detail data) must be enforced in Atrium Stats' own route handlers.

---

## Notes for Claude

- This is a GPL-3.0 self-hosted project — no cloud dependencies, no external hosted services
- Match Atrium's coding conventions: TypeScript strict, Server Components by default, all external calls through `lib/` clients
- The Sentinel API is the single source of truth for all Plex data — if something's missing, the right fix is adding it to Sentinel (flag it, don't work around it in Atrium Stats)
- Commit at the end of every batch, with a clear enough message that a fresh Claude session (potentially a different model) can read the git log and know exactly what's done and what's next
- If a batch genuinely can't be completed within a session, leave a note at the top of the relevant files (or a `PROGRESS.md`) describing exactly what's half-done and what the next step is — don't rely on conversation memory carrying over
- When in doubt about a pattern, check how Atrium or Sentinel does it — the whole ecosystem should feel like it came from the same developer
