import { describe, expect, it } from "vitest";
import { rankFavorites, type FavoriteWithLastDone } from "../src/report/rankFavorites.js";

function ride(overrides: Partial<FavoriteWithLastDone> & Pick<FavoriteWithLastDone, "id">): FavoriteWithLastDone {
  return {
    title: overrides.id,
    instructor_name: null,
    duration_seconds: 1800,
    last_done: null,
    original_air_time: null,
    join_token: null,
    ...overrides,
  };
}

describe("rankFavorites", () => {
  it("buckets canonical class lengths into 20/30/45/60", () => {
    const buckets = rankFavorites([
      ride({ id: "a", duration_seconds: 1200 }),
      ride({ id: "b", duration_seconds: 1800 }),
      ride({ id: "c", duration_seconds: 2700 }),
      ride({ id: "d", duration_seconds: 3600 }),
    ]);

    expect(buckets[20].map((r) => r.id)).toEqual(["a"]);
    expect(buckets[30].map((r) => r.id)).toEqual(["b"]);
    expect(buckets[45].map((r) => r.id)).toEqual(["c"]);
    expect(buckets[60].map((r) => r.id)).toEqual(["d"]);
  });

  it("drops rides whose length is not one of the four buckets", () => {
    const buckets = rankFavorites([
      ride({ id: "ten", duration_seconds: 600 }),
      ride({ id: "ninety", duration_seconds: 5400 }),
      ride({ id: "null-length", duration_seconds: null }),
    ]);

    expect(buckets[20]).toHaveLength(0);
    expect(buckets[30]).toHaveLength(0);
    expect(buckets[45]).toHaveLength(0);
    expect(buckets[60]).toHaveLength(0);
  });

  it("sorts never-done rides to the top, then oldest-completed first", () => {
    const buckets = rankFavorites([
      ride({ id: "recent", duration_seconds: 1800, last_done: 2_000 }),
      ride({ id: "never", duration_seconds: 1800, last_done: null }),
      ride({ id: "old", duration_seconds: 1800, last_done: 1_000 }),
    ]);

    expect(buckets[30].map((r) => r.id)).toEqual(["never", "old", "recent"]);
  });

  it("keeps multiple never-done rides ahead of every completed ride", () => {
    const buckets = rankFavorites([
      ride({ id: "done", duration_seconds: 3600, last_done: 500 }),
      ride({ id: "never-1", duration_seconds: 3600, last_done: null }),
      ride({ id: "never-2", duration_seconds: 3600, last_done: null }),
    ]);

    const ids = buckets[60].map((r) => r.id);
    expect(ids.slice(0, 2).sort()).toEqual(["never-1", "never-2"]);
    expect(ids[2]).toBe("done");
  });
});
