# PelotonDataScraper

Sync your personal Peloton workout history, favorite rides, and instructor roster into a local
SQLite database, then answer questions Peloton's own UI can't — like _"which of my favorite rides
have I not done in the longest time?"_

## Setup

```bash
npm install
cp .env.example .env      # then fill in your Peloton credentials
```

`.env` values:

| Variable            | Purpose                                          | Default        |
| ------------------- | ------------------------------------------------ | -------------- |
| `PELOTON_USERNAME`  | Your Peloton login email                         | _(required)_   |
| `PELOTON_PASSWORD`  | Your Peloton password                            | _(required)_   |
| `DB_PATH`           | Where the SQLite database is written             | `./peloton.db` |
| `SYNC_RECENT_COUNT` | Workouts fetched per incremental sync            | `20`           |
| `LOG_LEVEL`         | `fatal`\|`error`\|`warn`\|`info`\|`debug`\|`trace` | `info`         |

## Sync your data

```bash
npm run sync
```

The first run **backfills** your entire history; later runs pull only the most recent workouts
(re-seen workouts are ignored, so it's safe to run as often as you like). Favorites and instructors
are refreshed in full each run. Run this whenever you want fresh data.

## Dashboard: "Rides to Do Next"

Both modes show your favorite **cycling** rides bucketed by length (20 / 30 / 45 / 60 min), each list
ordered so the ride you've done **least recently is at the top** (never-done rides first). They read
the same synced database — run `npm run sync` first, and re-sync whenever you want newer numbers.

### 1. Generated static page (offline, no server)

```bash
npm run report
```

Writes a single self-contained `peloton-report.html` to the repo root — double-click to open it in
any browser. No server, nothing to keep running. The **+ Stack** buttons are disabled in this mode
(adding to your stack needs the live server below).

### 2. Interactive server (adds rides to your Peloton Stack)

```bash
npm run serve
# then open http://localhost:4173
```

Serves the same dashboard live, with a working **+ Stack** button on every row. Click it and the ride
is added straight to your real Peloton stack (the button turns into **Stacked ✓** and the header
shows your current stack count). Runs locally on your machine and uses your stored login — keep the
port to yourself; don't expose it to the network.

## Development

```bash
npm run build   # compile TypeScript to dist/
npm start       # run the compiled sync (node dist/index.js)
npm test        # run the Vitest unit tests
```

All source lives in `src/`; see [CLAUDE.md](CLAUDE.md) and
[docs/artifacts/peloton-sync-design-decisions.md](docs/artifacts/peloton-sync-design-decisions.md)
for architecture and the reasoning behind key decisions. AI agents: start with
[AGENTS.md](AGENTS.md).
