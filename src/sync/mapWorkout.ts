import type { WorkoutRow } from "../db/workoutsRepository.js";
import type { WorkoutDetail } from "../peloton/types.js";

export function mapWorkout(detail: WorkoutDetail, syncedAt: number): WorkoutRow {
  const startedAt = detail.start_time ?? detail.created_at ?? 0;
  const endedAt = detail.end_time;

  return {
    id: detail.id,
    started_at: startedAt,
    discipline: detail.fitness_discipline ?? null,
    fitness_discipline: detail.fitness_discipline ?? null,
    title: detail.ride?.title ?? null,
    instructor_name: detail.ride?.instructor?.name ?? null,
    duration_seconds: endedAt !== undefined ? endedAt - startedAt : null,
    total_work_kj: detail.total_work !== undefined ? detail.total_work / 1000 : null,
    distance_miles: detail.distance ?? null,
    calories: detail.calories ?? null,
    avg_heart_rate: detail.metrics_summary?.avg_heart_rate ?? null,
    max_heart_rate: detail.metrics_summary?.max_heart_rate ?? null,
    difficulty_rating: detail.ride_summary?.difficulty_rating_avg ?? null,
    status: detail.status ?? null,
    raw_json: JSON.stringify(detail),
    synced_at: syncedAt,
  };
}
