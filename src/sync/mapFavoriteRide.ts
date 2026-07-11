import type { FavoriteRideRow } from "../db/favoriteRidesRepository.js";
import type { RideSummary } from "../peloton/types.js";

export function mapFavoriteRide(ride: RideSummary, syncedAt: number): FavoriteRideRow {
  return {
    id: ride.id,
    title: ride.title ?? null,
    instructor_id: ride.instructor_id ?? null,
    fitness_discipline: ride.fitness_discipline ?? null,
    duration_seconds: ride.duration ?? null,
    difficulty_rating: ride.difficulty_rating_avg ?? null,
    original_air_time: ride.original_air_time ?? null,
    raw_json: JSON.stringify(ride),
    synced_at: syncedAt,
  };
}
