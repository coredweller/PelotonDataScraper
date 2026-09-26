import { describe, expect, it } from "vitest";
import { isHipHop90sTitle, selectUnfavoritedHipHop90s } from "../src/sync/hipHop90s.js";
import type { RideSummary } from "../src/peloton/types.js";

describe("isHipHop90sTitle", () => {
  it.each(["30 min 90s Hip Hop Ride", "15 min 90s Hip-Hop Ride", "20 min 90's hip hop ride"])("matches %s", (title) => {
    expect(isHipHop90sTitle(title)).toBe(true);
  });

  it.each(["30 min 90s Ride", "20 min 90s Pop Ride", "30 min Hip Hop Ride", "90 min Power Zone Endurance Ride", "30 min 1990s Hip Hop Ride"])(
    "does not match %s",
    (title) => {
      expect(isHipHop90sTitle(title)).toBe(false);
    },
  );

  it("does not match a ride with no title", () => {
    expect(isHipHop90sTitle(undefined)).toBe(false);
  });
});

describe("selectUnfavoritedHipHop90s", () => {
  it("keeps only 90s Hip Hop rides that aren't favorited, at every length", () => {
    const rides: RideSummary[] = [
      { id: "fav", title: "20 min 90s Hip Hop Ride", duration: 1200, is_favorite: true },
      { id: "short", title: "15 min 90s Hip-Hop Ride", duration: 900, is_favorite: false },
      { id: "long", title: "45 min 90s Hip Hop Ride", duration: 2700, is_favorite: false },
      { id: "unknown", title: "30 min 90s Hip Hop Ride", duration: 1800 },
      { id: "other", title: "30 min Hip Hop Ride", duration: 1800, is_favorite: false },
    ];

    expect(selectUnfavoritedHipHop90s(rides).map((ride) => ride.id)).toEqual(["short", "long", "unknown"]);
  });

  it("returns nothing for an empty listing", () => {
    expect(selectUnfavoritedHipHop90s([])).toEqual([]);
  });
});
