import { describe, expect, it } from "vitest";
import { mapFavoriteRide } from "../src/sync/mapFavoriteRide.js";
import type { RideSummary } from "../src/peloton/types.js";

describe("mapFavoriteRide", () => {
  it("maps a fully populated ride to a typed row", () => {
    const ride: RideSummary = {
      id: "ride-1",
      title: "30 min Power Zone Ride",
      instructor_id: "instructor-1",
      fitness_discipline: "cycling",
      duration: 1800,
      difficulty_rating_avg: 8.2,
      original_air_time: 1_690_000_000,
    };

    const row = mapFavoriteRide(ride, 1_700_002_000);

    expect(row).toEqual({
      id: "ride-1",
      title: "30 min Power Zone Ride",
      instructor_id: "instructor-1",
      fitness_discipline: "cycling",
      duration_seconds: 1800,
      difficulty_rating: 8.2,
      original_air_time: 1_690_000_000,
      raw_json: JSON.stringify(ride),
      synced_at: 1_700_002_000,
    });
  });

  it("falls back to nulls when optional fields are missing", () => {
    const ride: RideSummary = { id: "ride-2" };

    const row = mapFavoriteRide(ride, 1_700_100_500);

    expect(row.id).toBe("ride-2");
    expect(row.title).toBeNull();
    expect(row.instructor_id).toBeNull();
    expect(row.fitness_discipline).toBeNull();
    expect(row.duration_seconds).toBeNull();
    expect(row.difficulty_rating).toBeNull();
    expect(row.original_air_time).toBeNull();
    expect(row.raw_json).toBe(JSON.stringify(ride));
  });
});
