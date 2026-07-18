import Database from "better-sqlite3";
import { config } from "../config.js";
import type { FavoriteWithLastDone } from "./rankFavorites.js";

// Join each favorite ride to its most recent completion. The ride id lives only
// in workouts.raw_json ($.ride.id) — it isn't a promoted column — so the join
// key is extracted with json_extract (the intended pattern for un-promoted
// fields). last_done is NULL for favorites never completed.
const RANKED_FAVORITES_QUERY = `
  SELECT
    f.id                 AS id,
    f.title              AS title,
    f.duration_seconds   AS duration_seconds,
    i.name               AS instructor_name,
    json_extract(f.raw_json, '$.join_tokens.on_demand') AS join_token,
    f.original_air_time  AS original_air_time,
    MAX(w.started_at)    AS last_done
  FROM favorite_rides f
  LEFT JOIN instructors i ON i.id = f.instructor_id
  LEFT JOIN workouts    w ON json_extract(w.raw_json, '$.ride.id') = f.id
  WHERE f.fitness_discipline = 'cycling'
  GROUP BY f.id
`;

/**
 * Read every cycling favorite and its last-completed timestamp from the synced
 * database. Opens the DB read-only so it never contends with the sync writer.
 */
export function queryFavorites(): FavoriteWithLastDone[] {
  const db = new Database(config.DB_PATH, { readonly: true });
  try {
    return db.prepare(RANKED_FAVORITES_QUERY).all() as FavoriteWithLastDone[];
  } finally {
    db.close();
  }
}
