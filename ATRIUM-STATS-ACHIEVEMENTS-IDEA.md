# Future Enhancement Idea — Achievements System

> Not scoped for immediate build. Captured here so the idea doesn't get lost. Revisit once Atrium's core batches are further along and there's a natural home for it in the personal/Wrapped experience.
>
> **Revised October 2026** after reviewing Sentinel's current schema and source. Corrections, design constraints and new ideas are folded in below. Prerequisites are tracked in `AUDIT_REPORT.md`.

## The concept

A gamified achievements layer sitting on top of Sentinel's existing history data — "Night Owl," "First Sci-Fi Film," "100 Plays," that sort of thing. Spotted a comparable "streak" feature (current/longest watch streak, leaderboard of top streaks) in a competing project and it sparked the wider idea: Sentinel already has enough raw data in `session_history` and `metadata` to support a genuinely rich achievement system without much new collection work.

## Prerequisites — do these first

1. **Timezone-correct bucketing in Sentinel** (AUDIT_REPORT Open #2). Sentinel currently derives hours with `extract(hour from to_timestamp(...))` in the Postgres session timezone, almost certainly UTC. Every time-of-day or "same day" achievement (Night Owl, Marathoner, streaks) is wrong by an hour all summer until this is fixed.
2. **Close the genre gap** (see below) — only needed for the genre tier, so not a blocker for v1.

## What counts as a "watch"

Define this once, centrally, and use it for every achievement:

- **A play counts only if `complete = true`**, or `progress` is at or above some threshold (e.g. 80%). Counting raw session starts lets "100 Plays" be farmed with ten-second plays, and inflates counts with stop/start sessions.
- **A day counts towards a streak only if at least ~20 minutes were watched that day** (summed `duration`).

## Buildable with current data

Queries against data Sentinel already collects, once the prerequisites are met:

- **Night Owl** — X sessions started between midnight–4am (local time)
- **Marathoner** — 5+ episodes of the same show (`grandparent_key`) watched in one local day
- **Time Traveler** — watched something from before 1980 (`metadata.year`)
- **Century Club** (tiered) — 100 / 500 / 1000 completed plays
- **Streak system** (borrowed from the competitor that sparked this) — current/longest consecutive-day watch streak, plus a streak leaderboard (subject to the opt-in rules below)
- **First Night** — watched something within 24h of it landing in Plex (`metadata.plex_added_at`)
- **Epic** — finished a film of 3h or more (`metadata.duration`)
- **Comfort Rewatch** — completed the same `rating_key` 3+ times
- **Decade Explorer** (tiered) — films from N different decades (`metadata.year`). A good "variety" achievement until genres exist.
- **Studio Fan** — N films from one `metadata.studio` (Pixar, A24…)
- **Device Hopper** — watched on N distinct `platform`/`product` values
- **Road Warrior** — N plays with `location = 'wan'`. **Private-only** (see privacy rules).

### Needs a new Sentinel query, not a schema change

- **Completionist** — every episode of a series watched. The original draft listed this as query-only, but it needs each show's *total* episode count. `syncFullLibrary` does put every episode into `metadata`, so the data is there, but nothing exposes "episode count per `grandparent_key`". Also decide how to handle ongoing shows: a new episode airing shouldn't revoke the badge. Suggest scoping it to "all episodes available at the time".

### Dropped

- ~~**Transcode-Free Streak**~~ — users don't really control transcoding; their client and bandwidth do. It's an admin health metric (worth a chart on the admin dashboard), not a personal achievement.

## Blocked on an existing known gap — but cheaper to close than assumed

Genre-based achievements — "First Drama," "First Sci-Fi Film," "Genre Explorer" (watched N different genres) — need genre data. Sentinel's `metadata` table has no genres column, which is also why Atrium Stats' `genreBreakdown` has always returned `[]`.

Two findings make this smaller than it looked:

- **The Tautulli importer already selects `shm.genres`** (`collector/src/import/tautulli.ts:107`) and just throws it away. Backfilling imported history is mostly a matter of persisting what's already read.
- **Plex attaches genres to the show, not the episode.** Store genres on show/movie items, and have episode plays inherit them via `grandparent_key` when querying. Prefer a join table (`metadata_genres`) over a delimited text column, so "distinct genres per user" is a plain `COUNT(DISTINCT)`.

Do it in the same pass as whatever else touches `metadata`, rather than as a one-off. It also unblocks `genreBreakdown` and the "genre variety" signal in Wrapped's personality classifier.

## Where does this live? — Decided: B, with a Sentinel "facts" endpoint

- **Option A — Sentinel computes and stores unlock state.** Rejected: it puts presentation and gamification logic in the data vault.
- **Option B — Atrium Stats owns it.** Atrium Stats holds the definitions, thresholds, unlock state and presentation in its own local DB. This follows the leaderboard precedent: Sentinel stays pure data, and each consuming app owns its own gamification.

**One refinement:** Atrium Stats shouldn't compute achievements by paging raw `/v1/history` (1,000 rows per request, ~173k sessions in total). Instead, Sentinel exposes one generic, read-tier, per-user aggregation endpoint. It's plain data aggregation, in the same category as `/stats/user/:id`, so Sentinel stays "pure data":

```
GET /v1/stats/user/:userId/facts
→ completedPlays, distinctWatchDays[] (local dates), playsByHour[], oldestYearWatched,
  maxEpisodesOneShowOneDay, distinctDecades, distinctPlatforms, wanPlays,
  rewatchCounts (top N), firstNightCount, longestFilmCompleted, completedShows[] …
```

Atrium Stats turns facts into unlocks. The fallback, if a facts endpoint feels like too much Sentinel surface, is incremental evaluation: a per-user watermark plus `/v1/history?user_id=&from=` so only new sessions are ever read.

**Proxy note:** if this endpoint is added, register it in `src/lib/sentinel/proxyRules.ts` as `self-or-admin` with a strict integer user-id segment and explicit allowed query params, the same as `stats/user`. Or keep it server-side only, like `stats/leaderboard`.

## Design rules

### Unlock state is derived, and can always be rebuilt
- **Treat `user_achievements` as a cache of what history implies.** It's always fully recomputable from Sentinel data. That way Sentinel's `merge-duplicates` (which changes user ids), purges and re-imports only need a recompute, never a migration.
- **Never revoke.** A recompute can add unlocks but must never remove them, so tightening a threshold later doesn't take badges away.

### Backfill with historical dates
- **`unlocked_at` is the timestamp of the session that satisfied the condition, not when the code ran.** Otherwise the Tautulli-imported history makes every user unlock dozens of achievements on day one, and Wrapped's "you unlocked 4 achievements this year" becomes meaningless.
- **Store `trigger_session_id` alongside it**, for debugging and an optional "unlocked by watching X" detail.

### Privacy
Achievements reveal viewing habits, so they follow the same rules as the leaderboard:

- **Default visibility is private** — only the user (and the admin dashboard) sees them.
- **Streak leaderboard** — uses the existing two-tier opt-in and the shared `computeRank()` helper. No second ranking rule.
- **Public Wrapped share links** — never show achievements unless the user explicitly opts in, the same way `includeLeaderboard: false` keeps rank off share pages today.
- **Location-derived achievements** (Road Warrior, anything from geo/IP/WAN) — never shown publicly, even with opt-in.

### Naming
- **"Night Owl" is already a Wrapped personality** (`lib/stats/personality.ts`), with a different rule: peak hour, not session count. Either rename the achievement (e.g. "Midnight Club") or share one definition. Two different "Night Owls" will confuse people.

## Rough shape, if/when this gets built

- **A registry of achievement definitions in code, not the DB:**
  - `slug`, `name`, `description`, `icon`
  - `tiers?: { level, threshold, name }[]` — tiers built in from the start, rather than separate slugs per tier
  - `secret?: boolean` — hidden until unlocked
  - `visibility: 'private' | 'shareable'` — location-based ones are hard-wired `private`
  - `evaluate(facts) → { tier, triggerSessionId, unlockedAt } | null`
- **Table `user_achievements`** in Atrium Stats' SQLite:
  - `sentinel_user_id`, `achievement_slug`, `tier`, `unlocked_at` (historical), `trigger_session_id`, `computed_at`
  - primary key `(sentinel_user_id, achievement_slug, tier)`
- **When to evaluate:**
  - lazily on `/me` and Wrapped page loads (cheap with a facts endpoint);
  - optionally on live `stop` events. `lib/sentinel/liveBroadcast.ts` already receives these, but its connection only opens on the first admin visit, so it would need starting at boot.
- **UI:**
  - a section on Atrium Stats' personal stats page;
  - a Wrapped slide ("You unlocked 4 achievements this year"), filtered by historical `unlocked_at`.
- **Unlock toast** if the app is open when it happens — nice-to-have, not core.
- **Tests:** each definition's `evaluate()` is a pure function of facts. Unit-test them with `npm test`, like `tests/proxyRules.test.mjs`.
