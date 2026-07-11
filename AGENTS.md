# AGENTS.md

Machine-readable guide for AI agents working in this repository. Complements `CLAUDE.md` (which
pulls in the always-on rules under `.claude/rules/`). Read both before editing.

## Purpose

Personal-use tool. Syncs one Peloton account's workout history, favorite rides, and instructor
roster into local SQLite, and renders a "rides to do next" dashboard. No multi-account support, no
web auth, no scheduler (invoked manually or by an external scheduler).

## Commands

| Command         | Effect                                                              |
| --------------- | ------------------------------------------------------------------ |
| `npm run sync`  | `tsx src/index.ts` — auth + sync workouts/favorites/instructors    |
| `npm run report`| Generate static `peloton-report.html` (offline, buttons disabled)  |
| `npm run serve` | Start `node:http` server on `http://localhost:4173` (live + Stack) |
| `npm run build` | `tsc` → `dist/` (also copies `schema.sql`)                         |
| `npm start`     | Run compiled sync (`node dist/index.js`)                           |
| `npm test`      | `vitest run`                                                       |

No linter configured. There is no build step for `sync`/`report`/`serve` — they run `.ts` directly
via `tsx`.

## Runtime & conventions

- **ESM**, `"type": "module"`, strict TS, NodeNext resolution. **Imports of local `.ts` files use a
  `.js` extension** (e.g. `import { config } from "./config.js"`). Match this or the build breaks.
- **SQLite via `better-sqlite3`** (synchronous, raw prepared statements — no ORM). Schema in
  `src/db/schema.sql`, applied on every `openDatabase()` (all `CREATE TABLE IF NOT EXISTS`).
- **Config** = `src/config.ts` (Zod-validated env). Importing it validates the whole `.env`, so any
  entry point requires `PELOTON_USERNAME`/`PELOTON_PASSWORD` present even if unused.
- **Logging** = `src/logger.ts` (pino). Never `console.log` in product code; use the logger.
- **Errors** = `src/result.ts` `Result<T,E>` (`ok`/`fail`) for expected failures; throw for
  unexpected. Per `.claude/rules/code-standards.md`: every catch logs with context and either
  rethrows or returns an error state. No silent failures, no empty-array/mock fallbacks.
- **Timestamps are unix epoch _seconds_** everywhere (multiply by 1000 for JS `Date`).

## Layout

```
src/
  index.ts                 sync entry point
  config.ts logger.ts result.ts
  peloton/                 API client + auth (Auth0 OAuth2/PKCE)
    client.ts              REST + GraphQL (stack) calls
    auth.ts oauthFlow.ts cookieJar.ts types.ts
  db/                      schema.sql + one repository class per table
  sync/                    orchestrator (syncWorkouts.ts) + pure map*/pagination
  report/                  dashboard
    queryFavorites.ts      read-only SQL: cycling favorites + last-done + join_token
    rankFavorites.ts       PURE: bucket 20/30/45/60 + sort (never-done first, then oldest)
    renderReport.ts        PURE: buckets -> self-contained themed HTML (inline CSS/JS)
    index.ts               static generator (writes peloton-report.html)
    server.ts              node:http server: GET / , GET/POST /api/stack
test/                      Vitest — targets pure logic only
docs/artifacts/            design-decisions record ("why", not "how")
```

## Data model (query-relevant facts)

- `workouts` — immutable, `INSERT OR IGNORE`, keyed on Peloton workout id. `started_at` indexed.
  **The ride/class id is NOT a promoted column** — it lives only in `raw_json.ride.id`.
- `favorite_rides` — live snapshot, wholesale `DELETE`+`INSERT` each sync. `id` = ride id.
- `instructors` — `id` → `name`. Favorites store only `instructor_id`; join for names.
- Every table has `raw_json` with the full untouched API response — source of truth for anything
  not promoted. Read un-promoted fields with `json_extract(raw_json, '$.path')`.
- **Ride ↔ workout join:** `favorite_rides.id = json_extract(workouts.raw_json, '$.ride.id')`.
  Last-done = `MAX(workouts.started_at)`; `NULL` = never done.

## Peloton Stack API (GraphQL) — critical gotcha

The Stack lives on a **separate GraphQL gateway**, not the REST host, but takes the same bearer auth.
See `PelotonClient.getStack()` / `addToStack()`.

- Endpoint: `https://gql-graphql-gateway.prod.k8s.onepeloton.com/graphql`
- Read: `query { viewUserStack { numClasses totalTime } }`
- Add: `mutation { addClassToStack(input: { pelotonClassId: "<joinToken>" }) { numClasses totalTime } }`
- **`pelotonClassId` is the class _join token_, NOT the ride id.** It is
  `favorite_rides.raw_json.join_tokens.on_demand`. Passing the ride id (or any unknown id) is
  **silently ignored** — HTTP 200, `numClasses` unchanged, no error. The report query exposes it as
  `join_token`.
- Clear/set: `mutation { modifyStack(input: { pelotonClassIdList: [] }) { numClasses } }`.
- Introspection is disabled in prod; schema was recovered via Apollo "Did you mean…?" validation
  errors. Do not assume other operations exist without verifying the same way.

## Verification expectations

- Run `npm test` and `npx tsc --noEmit` after changes.
- New pure logic → add a Vitest test under `test/` (mirrors the `map*`/`rankFavorites` style).
- Prefer driving the real flow for runtime changes: `npm run serve` then exercise `/api/stack`.
- **Live Stack writes hit the real account.** Guard destructive tests (e.g. only clear the stack if
  `viewUserStack.numClasses === 0` first) and clean up after (`modifyStack` with `[]`).
- Do not commit or push unless asked. `peloton.db*`, `.env`, `dist/`, and `peloton-report.html` are
  gitignored — never commit them.
