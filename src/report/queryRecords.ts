import { queryReadonly } from "../db/connection.js";
import type { CompletedRide } from "./rankRecords.js";

// Every completed cycling workout with the ride metadata the records view needs.
// Ride id/title/duration/air time/join token live only inside workouts.raw_json,
// so they're pulled with json_extract. The instructor is resolved through the
// instructors table via $.ride.instructor_id — workouts.instructor_name is not
// populated by the API payload.
const COMPLETED_RIDES_QUERY = `
  SELECT
    json_extract(w.raw_json, '$.ride.id')                    AS ride_id,
    json_extract(w.raw_json, '$.ride.title')                 AS title,
    i.name                                                    AS instructor_name,
    json_extract(w.raw_json, '$.ride.duration')              AS duration_seconds,
    json_extract(w.raw_json, '$.ride.original_air_time')     AS original_air_time,
    json_extract(w.raw_json, '$.ride.join_tokens.on_demand') AS join_token,
    w.total_work_kj                                           AS output_kj,
    w.started_at                                              AS started_at
  FROM workouts w
  LEFT JOIN instructors i ON i.id = json_extract(w.raw_json, '$.ride.instructor_id')
  WHERE w.fitness_discipline = 'cycling'
    AND w.status = 'COMPLETE'
    AND w.total_work_kj IS NOT NULL
    AND json_extract(w.raw_json, '$.ride.id') IS NOT NULL
`;

/** Read every completed cycling workout with its output from the synced database. */
export function queryCompletedRides(): CompletedRide[] {
  return queryReadonly<CompletedRide>(COMPLETED_RIDES_QUERY);
}
