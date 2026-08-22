import { describe, expect, it } from "vitest";
import { renderReport } from "../src/report/renderReport.js";
import type { FavoriteWithLastDone, RankedBuckets } from "../src/report/rankFavorites.js";
import { rankRecords, type CompletedRide } from "../src/report/rankRecords.js";

const GENERATED_AT = new Date("2026-07-17T10:00:00Z");

// Mirror renderReport's own date formatting so assertions stay correct under any
// runtime locale/timezone (we're verifying which timestamp maps to which label,
// not the exact glyphs of a locale).
function label(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

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

/** Records built from the given completed workouts (none by default). */
function records(workouts: CompletedRide[] = []) {
  return rankRecords(workouts);
}

/** Empty buckets with `rides` placed in the given length. */
function bucketsWith(minutes: 20 | 30 | 45 | 60, rides: FavoriteWithLastDone[]): RankedBuckets {
  const buckets: RankedBuckets = { 20: [], 30: [], 45: [], 60: [] };
  buckets[minutes] = rides;
  return buckets;
}

describe("renderReport last-done cell", () => {
  it("shows the release date and the last-done date, each under its own label", () => {
    const airTime = 1_657_540_800; // 2022-07-11
    const lastDone = 1_659_312_000; // 2022-08-01
    const html = renderReport(bucketsWith(30, [ride({ id: "a", last_done: lastDone, original_air_time: airTime })]), records(), GENERATED_AT);

    expect(html).toContain(`<span class="dlabel">Released</span>${label(airTime)}`);
    expect(html).toContain(`<span class="dlabel">Last done</span>${label(lastDone)}`);
  });

  it("shows a 'Never done' badge and no last-done date when the ride was never completed", () => {
    const airTime = 1_657_540_800;
    const html = renderReport(bucketsWith(30, [ride({ id: "n", last_done: null, original_air_time: airTime })]), records(), GENERATED_AT);

    expect(html).toContain(`<span class="dlabel">Released</span>${label(airTime)}`);
    expect(html).toContain(`<span class="never">Never done</span>`);
    expect(html).not.toContain("Last done");
  });

  it("omits the release date when the ride has no original air time", () => {
    const lastDone = 1_659_312_000;
    const html = renderReport(bucketsWith(30, [ride({ id: "r", last_done: lastDone, original_air_time: null })]), records(), GENERATED_AT);

    expect(html).not.toContain("Released");
    expect(html).toContain(`<span class="dlabel">Last done</span>${label(lastDone)}`);
  });
});

describe("renderReport tabs", () => {
  it("marks the 20-min tab active and every other tab inactive", () => {
    const html = renderReport(bucketsWith(20, [ride({ id: "a" })]), records(), GENERATED_AT);

    expect(html).toContain(`id="tab-20" data-bucket="20" aria-controls="panel-20" aria-selected="true" tabindex="0"`);
    expect(html).toContain(`id="tab-30" data-bucket="30" aria-controls="panel-30" aria-selected="false" tabindex="-1"`);
  });

  it("shows only the first panel and hides the rest", () => {
    const html = renderReport(bucketsWith(20, [ride({ id: "a" })]), records(), GENERATED_AT);

    expect(html).toContain(`id="panel-20" role="tabpanel" aria-labelledby="tab-20" data-bucket="20">`);
    expect(html).toContain(`id="panel-30" role="tabpanel" aria-labelledby="tab-30" data-bucket="30" hidden>`);
  });

  it("labels each tab with its ride count", () => {
    const html = renderReport(
      bucketsWith(45, [ride({ id: "a" }), ride({ id: "b" }), ride({ id: "c" })]),
      records(),
      GENERATED_AT,
    );

    expect(html).toContain(`id="tab-45" data-bucket="45" aria-controls="panel-45" aria-selected="false" tabindex="-1">45 min <span class="count">3</span>`);
    expect(html).toContain(`>20 min <span class="count">0</span>`);
  });
});

describe("renderReport view switcher", () => {
  it("shows the rides view first and hides the records view", () => {
    const html = renderReport(bucketsWith(20, [ride({ id: "a" })]), records(), GENERATED_AT);

    expect(html).toContain(`id="view-tab-next" data-view="next" aria-controls="view-next" aria-selected="true" tabindex="0"`);
    expect(html).toContain(`id="view-tab-records" data-view="records" aria-controls="view-records" aria-selected="false" tabindex="-1"`);
    expect(html).toContain(`id="view-next" role="tabpanel" aria-labelledby="view-tab-next" data-view="next">`);
    expect(html).toContain(`id="view-records" role="tabpanel" aria-labelledby="view-tab-records" data-view="records" hidden>`);
  });
});

describe("renderReport records view", () => {
  const record = (overrides: Partial<CompletedRide> & Pick<CompletedRide, "ride_id">): CompletedRide => ({
    title: overrides.ride_id,
    instructor_name: null,
    duration_seconds: 1200,
    original_air_time: null,
    join_token: null,
    output_kj: 100,
    started_at: 1_600_000_000,
    ...overrides,
  });

  it("headlines each length with its record output and the date it was set", () => {
    const achievedAt = 1_659_312_000; // 2022-08-01
    const html = renderReport(
      bucketsWith(20, []),
      records([record({ ride_id: "pr", output_kj: 257.4, started_at: achievedAt })]),
      GENERATED_AT,
    );

    expect(html).toContain(`PR 257 kJ on ${label(achievedAt)}`);
  });

  it("shows the record ride with its output, average watts, and the same dates as the rides list", () => {
    const airTime = 1_657_540_800; // 2022-07-11
    const html = renderReport(
      bucketsWith(20, []),
      records([
        record({ ride_id: "pr", title: "20 min 90s Hip Hop Ride", instructor_name: "Alex Toussaint", output_kj: 240, original_air_time: airTime }),
      ]),
      GENERATED_AT,
    );

    expect(html).toContain(`<li class="item item--record">`);
    expect(html).toContain(`<span class="output-kj">240 kJ</span>`);
    expect(html).toContain(`<span class="output-watts">200 W avg</span>`);
    expect(html).toContain(`<span class="ride-title">20 min 90s Hip Hop Ride</span>`);
    expect(html).toContain(`<span class="ride-instructor">Alex Toussaint</span>`);
    expect(html).toContain(`<span class="dlabel">Released</span>${label(airTime)}`);
  });

  it("offers a stack button for a record ride that has a join token", () => {
    const html = renderReport(
      bucketsWith(20, []),
      records([record({ ride_id: "pr", join_token: "tok-123" })]),
      GENERATED_AT,
    );

    expect(html).toContain(`data-join-token="tok-123"`);
  });

  it("reports empty lengths instead of rendering an empty leaderboard", () => {
    const html = renderReport(bucketsWith(20, []), records(), GENERATED_AT);

    expect(html).toContain("No completed rides at this length yet.");
  });

  it("renders the headline stat tiles", () => {
    const html = renderReport(
      bucketsWith(20, []),
      records([
        record({ ride_id: "a", instructor_name: "Alex", output_kj: 240 }),
        record({ ride_id: "b", instructor_name: "Alex", output_kj: 100 }),
      ]),
      GENERATED_AT,
    );

    expect(html).toContain(`<span class="tile-label">Total output</span>\n        <span class="tile-value">340 kJ</span>`);
    expect(html).toContain(`<span class="tile-label">Best ride output</span>\n        <span class="tile-value">240 kJ</span>`);
    expect(html).toContain(`<span class="tile-label">Top instructor</span>\n        <span class="tile-value">Alex</span><span class="tile-note">2 rides</span>`);
  });
});

describe("renderReport most-ridden view", () => {
  const workout = (rideId: string, overrides: Partial<CompletedRide> = {}): CompletedRide => ({
    ride_id: rideId,
    title: rideId,
    instructor_name: null,
    duration_seconds: 1200,
    original_air_time: null,
    join_token: null,
    output_kj: 100,
    started_at: 1_600_000_000,
    ...overrides,
  });

  it("headlines each length with its most-ridden count and lists the tally per row", () => {
    const html = renderReport(
      bucketsWith(20, []),
      records([
        workout("repeat", { title: "20 min Pop Ride", started_at: 1_600_000_000 }),
        workout("repeat", { title: "20 min Pop Ride", started_at: 1_600_100_000 }),
        workout("repeat", { title: "20 min Pop Ride", started_at: 1_600_200_000 }),
        workout("single"),
      ]),
      GENERATED_AT,
    );

    expect(html).toContain("Most ridden by class length");
    expect(html).toContain(`<span class="pr">Most ridden 3×</span>`);
    expect(html).toContain(`<span class="tally-count">3×</span>`);
    expect(html).toContain(`<span class="tally-label">times</span>`);
    expect(html).toContain(`<span class="tally-count">1×</span>`);
    expect(html).toContain(`<span class="tally-label">time</span>`);
  });

  it("still renders the output leaderboard alongside the most-ridden one", () => {
    const html = renderReport(bucketsWith(20, []), records([workout("pr", { output_kj: 240 })]), GENERATED_AT);

    expect(html).toContain("Highest output by class length");
    expect(html).toContain(`<span class="output-kj">240 kJ</span>`);
    expect(html).toContain(`<span class="tally-count">1×</span>`);
  });
});
