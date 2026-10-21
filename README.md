# Atrium Stats

A self-hosted Tautulli-replacement dashboard and Spotify-Wrapped-style personal year-in-review for
Plex, built entirely on top of [Sentinel](https://github.com/LFFPicard/sentinel)'s API. Live
activity, full history, per-user and per-library statistics, graphs, IP lookups, and a personal
"Wrapped" slideshow — all in one self-hosted app.

Part of the LFFPicard homelab ecosystem — see [`ATRIUM_STATS.md`](./ATRIUM_STATS.md) for the full
project brief, architecture, and build plan.

## Requirements

- A running [Sentinel](https://github.com/LFFPicard/sentinel) instance with a read-tier API key
  (create one from Sentinel's admin UI at `/admin/api-keys`)
- Docker + docker-compose

## Quick start

1. Copy `.env.example` to `.env` and fill in `SENTINEL_URL` and `SENTINEL_API_KEY`
2. `docker compose up -d`
3. Visit the app and sign in with Plex

## License

GPL-3.0
