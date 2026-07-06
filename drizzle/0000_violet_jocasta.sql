CREATE TABLE `leaderboard_opt_in` (
	`sentinel_user_id` integer PRIMARY KEY NOT NULL,
	`opted_in` integer DEFAULT false NOT NULL,
	`fully_public` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`sentinel_user_id` integer NOT NULL,
	`plex_id` text NOT NULL,
	`username` text NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `share_tokens` (
	`token` text PRIMARY KEY NOT NULL,
	`sentinel_user_id` integer NOT NULL,
	`year` integer NOT NULL,
	`created_at` integer NOT NULL
);
