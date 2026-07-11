# Peloton Data Sync — Design Decisions

Record of the key decisions made while building the Peloton personal data sync tool, and why. This is not a full architecture doc — see `CLAUDE.md` and the code itself for that. This is the "why," which doesn't survive in the code.

## Scope

- One runnable sync script (`npm run sync`), invoked manually or by an external scheduler. Scheduling (cron / Task Scheduler / GitHub Actions) is explicitly out of scope for this build.
- Personal use only: syncs the authenticated user's own workout history, favorites, and the instructor roster. No multi-account support.
- No NL query layer yet — this is the data-collection layer it will eventually sit behind.

## Backfill vs. incremental sync

**Decision:** One script handles both modes automatically — no separate backfill command.

- `WorkoutsRepository.isEmpty()` is checked once at the top of each run.
- Empty DB → **backfill**: page through `/api/user/{id}/workouts` from page 0 until a short page is returned, fetching full detail and upserting every workout.
- Non-empty DB → **incremental**: fetch only the most recent `SYNC_RECENT_COUNT` workouts (default 20).
- **Why:** `INSERT OR IGNORE` makes re-seen workouts a no-op, so incremental mode doesn't need a "last synced timestamp" — N just needs to comfortably cover a day's (or a few missed days') workouts. This avoids a stateful cursor and an entire class of off-by-one/timezone bugs.

## Idempotency and storage model

- **Workouts are immutable** once complete → `INSERT OR IGNORE` keyed on Peloton's own workout ID. Never updated after first insert.
- **Favorites and the instructor roster are mutable, whole-collection snapshots** the API returns in full each call (there's no "what changed since X" endpoint) → each sync **wholesale replaces** `favorite_rides` and `instructors` (`DELETE` + bulk `INSERT` in one transaction), not upsert.
  - **Why:** unfavoriting a ride, or Peloton retiring an instructor, needs to be reflected locally. Upserting would only ever grow these tables; replacing keeps them a true mirror of current API state.
- Every table keeps a `raw_json` column with the full untouched API response alongside promoted/typed columns. **Why:** the API is unofficial and undocumented — fields get added, renamed, or omitted per workout type (e.g. strength vs. cycling). Promoted columns cover the common query cases; `raw_json` is the source of truth for anything not promoted, so no data is ever silently dropped by an incomplete mapping.
- `performance_graph` time-series data (second-by-second output/cadence/resistance) is deliberately **not fetched** in this build — one extra request per workout during backfill for data not yet needed. Deferred to a fast-follow.

## Authentication: Auth0 OAuth2/PKCE (not simple session login)

**Original plan:** `POST /auth/login` with username/password → session cookie. This was Peloton's documented-by-reverse-engineering flow at the time of the original design.

**What happened:** mid-build, that endpoint returned a hard `403 Access forbidden. Endpoint no longer accepting requests.` — Peloton had migrated to Auth0-hosted OAuth2 with PKCE, with no announcement. Root-caused via a merged fix in an actively-maintained open-source project (`philosowaffle/peloton-to-garmin`) rather than official docs, since none exist.

**Decision (user-confirmed):** implement the full automated OAuth2/PKCE flow, persisting refresh tokens in SQLite (`auth_state` table), rather than falling back to a manual bearer-token-in-`.env` approach.
- **Why:** a scheduled daily sync can't pause for a human to paste a fresh token. Persisting the refresh token means a full HTML-scraping login only happens once (or when a refresh token is rejected); every other run reuses or refreshes the cached access token.
- **Trade-off accepted:** this makes the auth layer significantly more fragile — it depends on scraping Auth0's hosted login form, following a manual redirect chain, and evading Auth0's bot/anomaly detection (real browser `User-Agent`, correctly reusing the `state` parameter Auth0 rewrites mid-flow). Any of those could break again without notice, same as the original endpoint did. Accepted because the alternative (manual token refresh) defeats the "runs unattended" goal.

## Error handling

- No silent failures: every catch block logs with context and either rethrows or returns a `Result` error state — never an empty array or swallowed exception.
- A failed workout upsert logs and skips that one workout rather than aborting the whole sync (partial progress is preferable to losing an otherwise-successful backfill over one bad row).
- A failed favorites/instructors sync logs an error but does not fail the whole run — workout sync is the primary purpose; the two roster tables are supplementary.

## Testing

- Vitest added from the start, not deferred. Unit tests target the pure, deterministic logic: field-mapping functions (`mapWorkout`, `mapFavoriteRide`, `mapInstructor`) and pagination-termination logic (`isLastPage`) — the pieces most likely to silently regress and cheapest to verify without hitting the real API.
- No integration tests against the live Peloton API (no test account, and unnecessary API load on undocumented endpoints).

## Explicitly not built

GraphQL stack/tags API, scheduler wiring, NL query layer, `performance_graph` storage, a migration framework, retry/backoff/rate-limiting infrastructure, multi-account support, a services/repositories interface split. Kept deliberately thin per the project's YAGNI stance — add these when an actual need appears, not speculatively.
