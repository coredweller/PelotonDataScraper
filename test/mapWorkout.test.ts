import { describe, expect, it } from "vitest";
import { mapWorkout } from "../src/sync/mapWorkout.js";
import type { WorkoutDetail } from "../src/peloton/types.js";

describe("mapWorkout", () => {
  it("maps a fully populated workout detail to a typed row", () => {
    const detail: WorkoutDetail = {
      id: "workout-1",
      start_time: 1_700_000_000,
      end_time: 1_700_001_800,
      status: "COMPLETE",
      fitness_discipline: "cycling",
      ride: {
        id: "ride-1",
        title: "30 min Power Zone Ride",
        instructor: { id: "instructor-1", name: "Robin Arzon" },
      },
      total_work: 500_000,
      distance: 12.5,
      calories: 400,
      ride_summary: { difficulty_rating_avg: 8.2 },
      metrics_summary: { avg_heart_rate: 145, max_heart_rate: 172 },
    };

    const row = mapWorkout(detail, 1_700_002_000);

    expect(row).toEqual({
      id: "workout-1",
      started_at: 1_700_000_000,
      discipline: "cycling",
      fitness_discipline: "cycling",
      title: "30 min Power Zone Ride",
      instructor_name: "Robin Arzon",
      duration_seconds: 1800,
      total_work_kj: 500,
      distance_miles: 12.5,
      calories: 400,
      avg_heart_rate: 145,
      max_heart_rate: 172,
      difficulty_rating: 8.2,
      status: "COMPLETE",
      raw_json: JSON.stringify(detail),
      synced_at: 1_700_002_000,
    });
  });

  it("falls back to nulls when optional fields are missing (e.g. a strength workout)", () => {
    const detail: WorkoutDetail = {
      id: "workout-2",
      created_at: 1_700_100_000,
      status: "COMPLETE",
      fitness_discipline: "strength",
    };

    const row = mapWorkout(detail, 1_700_100_500);

    expect(row.id).toBe("workout-2");
    expect(row.started_at).toBe(1_700_100_000);
    expect(row.title).toBeNull();
    expect(row.instructor_name).toBeNull();
    expect(row.duration_seconds).toBeNull();
    expect(row.total_work_kj).toBeNull();
    expect(row.distance_miles).toBeNull();
    expect(row.avg_heart_rate).toBeNull();
    expect(row.max_heart_rate).toBeNull();
    expect(row.difficulty_rating).toBeNull();
    expect(row.raw_json).toBe(JSON.stringify(detail));
  });
});
