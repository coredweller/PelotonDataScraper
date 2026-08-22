import { describe, expect, it } from "vitest";
import { rankRecords, RECORDS_PER_BUCKET, type CompletedRide } from "../src/report/rankRecords.js";

function workout(overrides: Partial<CompletedRide> & Pick<CompletedRide, "ride_id">): CompletedRide {
  return {
    title: overrides.ride_id,
    instructor_name: null,
    duration_seconds: 1800,
    original_air_time: null,
    join_token: null,
    output_kj: 100,
    started_at: 1_600_000_000,
    ...overrides,
  };
}

describe("rankRecords leaderboards", () => {
  it("buckets canonical class lengths into 20/30/45/60", () => {
    const { buckets } = rankRecords([
      workout({ ride_id: "a", duration_seconds: 1200 }),
      workout({ ride_id: "b", duration_seconds: 1800 }),
      workout({ ride_id: "c", duration_seconds: 2700 }),
      workout({ ride_id: "d", duration_seconds: 3600 }),
    ]);

    expect(buckets[20].map((r) => r.id)).toEqual(["a"]);
    expect(buckets[30].map((r) => r.id)).toEqual(["b"]);
    expect(buckets[45].map((r) => r.id)).toEqual(["c"]);
    expect(buckets[60].map((r) => r.id)).toEqual(["d"]);
  });

  it("drops rides whose length isn't one of the four buckets", () => {
    const { buckets } = rankRecords([
      workout({ ride_id: "warmup", duration_seconds: 300 }),
      workout({ ride_id: "long", duration_seconds: 5400 }),
    ]);

    expect(buckets[20].concat(buckets[30], buckets[45], buckets[60])).toEqual([]);
  });

  it("ranks a length by highest output first", () => {
    const { buckets } = rankRecords([
      workout({ ride_id: "low", output_kj: 120 }),
      workout({ ride_id: "high", output_kj: 300 }),
      workout({ ride_id: "mid", output_kj: 200 }),
    ]);

    expect(buckets[30].map((r) => r.id)).toEqual(["high", "mid", "low"]);
    expect(buckets[30][0].output_kj).toBe(300);
  });

  it("keeps a ride's best output and the date it was set, not its latest workout", () => {
    const { buckets } = rankRecords([
      workout({ ride_id: "r", output_kj: 250, started_at: 1_600_000_000 }),
      workout({ ride_id: "r", output_kj: 180, started_at: 1_700_000_000 }),
    ]);

    expect(buckets[30]).toHaveLength(1);
    expect(buckets[30][0].output_kj).toBe(250);
    expect(buckets[30][0].achieved_at).toBe(1_600_000_000);
    expect(buckets[30][0].last_done).toBe(1_700_000_000);
  });

  it("credits an equal output to the workout that set it first", () => {
    const { buckets } = rankRecords([
      workout({ ride_id: "r", output_kj: 250, started_at: 1_700_000_000 }),
      workout({ ride_id: "r", output_kj: 250, started_at: 1_600_000_000 }),
    ]);

    expect(buckets[30][0].achieved_at).toBe(1_600_000_000);
  });

  it("caps each length at the leaderboard size", () => {
    const workouts = Array.from({ length: RECORDS_PER_BUCKET + 3 }, (_, index) =>
      workout({ ride_id: `r${index}`, output_kj: 100 + index }),
    );

    expect(rankRecords(workouts).buckets[30]).toHaveLength(RECORDS_PER_BUCKET);
  });
});

describe("rankRecords stats", () => {
  it("totals every completed ride, including lengths no leaderboard shows", () => {
    const { stats } = rankRecords([
      workout({ ride_id: "a", output_kj: 100, duration_seconds: 1800 }),
      workout({ ride_id: "a", output_kj: 150, duration_seconds: 1800 }),
      workout({ ride_id: "warmup", output_kj: 20, duration_seconds: 300 }),
    ]);

    expect(stats.totalRides).toBe(3);
    expect(stats.uniqueRides).toBe(2);
    expect(stats.totalOutputKj).toBe(270);
    expect(stats.totalSeconds).toBe(3900);
    expect(stats.bestOutputKj).toBe(150);
  });

  it("computes best average watts from output over the class length", () => {
    // 180 kJ over 1800 s is 100 W; the shorter ride is the harder effort.
    const { stats } = rankRecords([
      workout({ ride_id: "a", output_kj: 180, duration_seconds: 1800 }),
      workout({ ride_id: "b", output_kj: 150, duration_seconds: 1200 }),
    ]);

    expect(stats.bestAverageWatts).toBe(125);
  });

  it("ignores rides with no usable length when totalling time and watts", () => {
    const { stats } = rankRecords([
      workout({ ride_id: "a", output_kj: 180, duration_seconds: 1800 }),
      workout({ ride_id: "b", output_kj: 90, duration_seconds: null }),
      workout({ ride_id: "c", output_kj: 90, duration_seconds: 0 }),
    ]);

    expect(stats.totalSeconds).toBe(1800);
    expect(stats.bestAverageWatts).toBe(100);
    expect(stats.totalOutputKj).toBe(360);
  });

  it("picks the instructor with the most rides and the earliest ride date", () => {
    const { stats } = rankRecords([
      workout({ ride_id: "a", instructor_name: "Alex", started_at: 1_500_000_000 }),
      workout({ ride_id: "b", instructor_name: "Alex", started_at: 1_600_000_000 }),
      workout({ ride_id: "c", instructor_name: "Emma", started_at: 1_400_000_000 }),
      workout({ ride_id: "d", instructor_name: null, started_at: 1_700_000_000 }),
    ]);

    expect(stats.topInstructor).toEqual({ name: "Alex", rides: 2 });
    expect(stats.firstRideAt).toBe(1_400_000_000);
  });

  it("returns empty stats rather than throwing when there are no rides", () => {
    const { stats, buckets } = rankRecords([]);

    expect(stats.totalRides).toBe(0);
    expect(stats.bestOutputKj).toBeNull();
    expect(stats.bestAverageWatts).toBeNull();
    expect(stats.topInstructor).toBeNull();
    expect(stats.firstRideAt).toBeNull();
    expect(buckets[20]).toEqual([]);
  });
});

describe("rankRecords most-ridden leaderboards", () => {
  it("counts a ride's completions and ranks the most-taken first", () => {
    const { mostRidden } = rankRecords([
      workout({ ride_id: "twice" }),
      workout({ ride_id: "twice" }),
      workout({ ride_id: "thrice" }),
      workout({ ride_id: "thrice" }),
      workout({ ride_id: "thrice" }),
      workout({ ride_id: "once" }),
    ]);

    expect(mostRidden[30].map((r) => r.id)).toEqual(["thrice", "twice", "once"]);
    expect(mostRidden[30].map((r) => r.times_done)).toEqual([3, 2, 1]);
  });

  it("breaks a tie on completions with the higher personal best", () => {
    const { mostRidden } = rankRecords([
      workout({ ride_id: "weaker", output_kj: 100 }),
      workout({ ride_id: "weaker", output_kj: 110 }),
      workout({ ride_id: "stronger", output_kj: 100 }),
      workout({ ride_id: "stronger", output_kj: 300 }),
    ]);

    expect(mostRidden[30].map((r) => r.id)).toEqual(["stronger", "weaker"]);
  });

  it("keeps each length separate and caps it at the leaderboard size", () => {
    const workouts = Array.from({ length: RECORDS_PER_BUCKET + 3 }, (_, index) =>
      Array.from({ length: index + 1 }, () => workout({ ride_id: `r${index}`, duration_seconds: 1200 })),
    ).flat();

    const { mostRidden } = rankRecords(workouts.concat(workout({ ride_id: "hour", duration_seconds: 3600 })));

    expect(mostRidden[20]).toHaveLength(RECORDS_PER_BUCKET);
    expect(mostRidden[20][0].id).toBe(`r${RECORDS_PER_BUCKET + 2}`);
    expect(mostRidden[60].map((r) => r.id)).toEqual(["hour"]);
  });

  it("ranks the same rides independently of the output leaderboard", () => {
    const { buckets, mostRidden } = rankRecords([
      workout({ ride_id: "grinder", output_kj: 100 }),
      workout({ ride_id: "grinder", output_kj: 100 }),
      workout({ ride_id: "pr", output_kj: 400 }),
    ]);

    expect(buckets[30].map((r) => r.id)).toEqual(["pr", "grinder"]);
    expect(mostRidden[30].map((r) => r.id)).toEqual(["grinder", "pr"]);
  });

  it("returns empty most-ridden lengths when there are no rides", () => {
    expect(rankRecords([]).mostRidden[45]).toEqual([]);
  });
});
