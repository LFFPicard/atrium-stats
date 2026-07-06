import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Atrium Stats' own local data — never Plex data. All actual Plex/session/stats
// data lives in Sentinel and is read through the Sentinel API client instead.

// Browser session → Sentinel user linkage, established after the Plex OAuth handshake.
// Cookie holds only the `token`; everything else is looked up server-side from this row.
export const sessions = sqliteTable('sessions', {
  token: text('token').primaryKey(),
  sentinelUserId: integer('sentinel_user_id').notNull(),
  plexId: text('plex_id').notNull(),
  username: text('username').notNull(),
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
});

// Per-user leaderboard visibility preference. Absent row = not opted in (default hidden).
export const leaderboardOptIn = sqliteTable('leaderboard_opt_in', {
  sentinelUserId: integer('sentinel_user_id').primaryKey(),
  optedIn: integer('opted_in', { mode: 'boolean' }).notNull().default(false),
  // Opted into full public visibility — otherwise neighbours in the leaderboard only ever
  // see this user as "Rank +1 / Rank -1" without a name attached.
  fullyPublic: integer('fully_public', { mode: 'boolean' }).notNull().default(false),
  updatedAt: integer('updated_at').notNull(),
});

// Public, read-only Wrapped share links — never expose other users' data through these.
export const shareTokens = sqliteTable('share_tokens', {
  token: text('token').primaryKey(),
  sentinelUserId: integer('sentinel_user_id').notNull(),
  year: integer('year').notNull(),
  createdAt: integer('created_at').notNull(),
});
