import { BUCKET_MINUTES, isBucketMinutes, type BucketMinutes, type FavoriteWithLastDone } from "./rankFavorites.js";

/** How many rides each class length's output leaderboard shows. */
export const RECORDS_PER_BUCKET = 5;

/** One completed cycling workout joined to the ride it was taken from. */
export interface CompletedRide {
  ride_id: string;
  title: string | null;
  instructor_name: string | null;
  /** The class's scheduled length in seconds (not the workout's wall-clock span). */
  duration_seconds: number | null;
  original_air_time: number | null;
  join_token: string | null;
  /** Total output for this workout in kJ. */
  output_kj: number;
  /** Unix epoch seconds the workout started. */
  started_at: number;
}

/**
 * A ride's personal best. Extends the shape the "Rides to Do Next" list renders
 * so both views show the same per-ride information, plus the record itself.
 */
export interface OutputRecord extends FavoriteWithLastDone {
  /** Best total output ever recorded on this ride, in kJ. */
  output_kj: number;
  /** Unix epoch seconds of the workout that set that best output. */
  achieved_at: number;
}

/** Headline numbers across every completed cycling ride. */
export interface RideStats {
  totalRides: number;
  uniqueRides: number;
  totalOutputKj: number;
  totalSeconds: number;
  /** Best single-workout output in kJ, or null when there are no rides. */
  bestOutputKj: number | null;
  /** Best average output in watts across a single workout, or null when unknown. */
  bestAverageWatts: number | null;
  topInstructor: { name: string; rides: number } | null;
  /** Unix epoch seconds of the earliest ride, or null when there are no rides. */
  firstRideAt: number | null;
}

export interface RideRecords {
  stats: RideStats;
  buckets: Record<BucketMinutes, OutputRecord[]>;
}

/** Average watts sustained over a workout: kJ → J spread across its seconds. */
function averageWatts(outputKj: number, durationSeconds: number): number {
  return (outputKj * 1000) / durationSeconds;
}

/**
 * Reduce every workout of a single ride to that ride's personal best: the
 * highest output, the date it was set, and the most recent time the ride was
 * taken. Ties go to the earliest workout — that's when the bar was first set.
 */
function toOutputRecord(workouts: CompletedRide[]): OutputRecord {
  let best = workouts[0];
  let lastDone = workouts[0].started_at;

  for (const workout of workouts) {
    if (workout.output_kj > best.output_kj) best = workout;
    else if (workout.output_kj === best.output_kj && workout.started_at < best.started_at) best = workout;
    if (workout.started_at > lastDone) lastDone = workout.started_at;
  }

  return {
    id: best.ride_id,
    title: best.title,
    instructor_name: best.instructor_name,
    duration_seconds: best.duration_seconds,
    original_air_time: best.original_air_time,
    join_token: best.join_token,
    last_done: lastDone,
    output_kj: best.output_kj,
    achieved_at: best.started_at,
  };
}

/** Highest output first; equal outputs keep the older record ahead. */
function compareByOutput(a: OutputRecord, b: OutputRecord): number {
  if (b.output_kj !== a.output_kj) return b.output_kj - a.output_kj;
  return a.achieved_at - b.achieved_at;
}

function pickTopInstructor(rows: CompletedRide[]): { name: string; rides: number } | null {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.instructor_name === null) continue;
    counts.set(row.instructor_name, (counts.get(row.instructor_name) ?? 0) + 1);
  }

  let top: { name: string; rides: number } | null = null;
  for (const [name, rides] of counts) {
    if (top === null || rides > top.rides) top = { name, rides };
  }
  return top;
}

function summarise(rows: CompletedRide[], uniqueRides: number): RideStats {
  const stats: RideStats = {
    totalRides: rows.length,
    uniqueRides,
    totalOutputKj: 0,
    totalSeconds: 0,
    bestOutputKj: null,
    bestAverageWatts: null,
    topInstructor: pickTopInstructor(rows),
    firstRideAt: null,
  };

  for (const row of rows) {
    stats.totalOutputKj += row.output_kj;
    if (stats.bestOutputKj === null || row.output_kj > stats.bestOutputKj) stats.bestOutputKj = row.output_kj;
    if (stats.firstRideAt === null || row.started_at < stats.firstRideAt) stats.firstRideAt = row.started_at;

    // A missing or zero-length class can't contribute time or a watts average.
    if (row.duration_seconds === null || row.duration_seconds <= 0) continue;
    stats.totalSeconds += row.duration_seconds;
    const watts = averageWatts(row.output_kj, row.duration_seconds);
    if (stats.bestAverageWatts === null || watts > stats.bestAverageWatts) stats.bestAverageWatts = watts;
  }

  return stats;
}

/**
 * Turn completed cycling workouts into per-length output leaderboards plus
 * overall stats. Every workout counts toward the stats; only rides whose length
 * rounds to 20/30/45/60 minutes appear on a leaderboard.
 */
export function rankRecords(rows: CompletedRide[]): RideRecords {
  const byRide = new Map<string, CompletedRide[]>();
  for (const row of rows) {
    const existing = byRide.get(row.ride_id);
    if (existing) existing.push(row);
    else byRide.set(row.ride_id, [row]);
  }

  const buckets: Record<BucketMinutes, OutputRecord[]> = { 20: [], 30: [], 45: [], 60: [] };

  for (const workouts of byRide.values()) {
    const record = toOutputRecord(workouts);
    if (record.duration_seconds === null) continue;
    const minutes = Math.round(record.duration_seconds / 60);
    if (!isBucketMinutes(minutes)) continue;
    buckets[minutes].push(record);
  }

  for (const minutes of BUCKET_MINUTES) {
    buckets[minutes].sort(compareByOutput);
    buckets[minutes] = buckets[minutes].slice(0, RECORDS_PER_BUCKET);
  }

  return { stats: summarise(rows, byRide.size), buckets };
}
