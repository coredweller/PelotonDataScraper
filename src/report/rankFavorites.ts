/** The four class lengths (in minutes) the dashboard ranks. */
export const BUCKET_MINUTES = [20, 30, 45, 60] as const;
export type BucketMinutes = (typeof BUCKET_MINUTES)[number];

/** One favorite cycling ride plus when it was last completed. */
export interface FavoriteWithLastDone {
  id: string;
  title: string | null;
  instructor_name: string | null;
  duration_seconds: number | null;
  /** Unix epoch seconds of the most recent completion, or null if never done. */
  last_done: number | null;
  /** The class join token used to add this ride to the Peloton stack, or null if unavailable. */
  join_token: string | null;
}

export type RankedBuckets = Record<BucketMinutes, FavoriteWithLastDone[]>;

function isBucketMinutes(minutes: number): minutes is BucketMinutes {
  return (BUCKET_MINUTES as readonly number[]).includes(minutes);
}

/**
 * Order two rides by priority: never-done first, then oldest-completed first.
 * A ride you've never done is the ultimate "least recently done", so it ranks
 * above every completed ride.
 */
function compareByLastDone(a: FavoriteWithLastDone, b: FavoriteWithLastDone): number {
  if (a.last_done === null && b.last_done === null) return 0;
  if (a.last_done === null) return -1;
  if (b.last_done === null) return 1;
  return a.last_done - b.last_done;
}

/**
 * Bucket cycling favorites into 20/30/45/60-minute lists and sort each list so
 * the ride done furthest in the past (or never) is first. Rides whose length
 * doesn't round to one of the four target buckets are dropped.
 */
export function rankFavorites(rows: FavoriteWithLastDone[]): RankedBuckets {
  const buckets: RankedBuckets = { 20: [], 30: [], 45: [], 60: [] };

  for (const row of rows) {
    if (row.duration_seconds === null) continue;
    const minutes = Math.round(row.duration_seconds / 60);
    if (!isBucketMinutes(minutes)) continue;
    buckets[minutes].push(row);
  }

  for (const minutes of BUCKET_MINUTES) {
    buckets[minutes].sort(compareByLastDone);
  }

  return buckets;
}
