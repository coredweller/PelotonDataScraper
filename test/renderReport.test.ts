import { describe, expect, it } from "vitest";
import { renderReport } from "../src/report/renderReport.js";
import type { FavoriteWithLastDone, RankedBuckets } from "../src/report/rankFavorites.js";

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
    const html = renderReport(bucketsWith(30, [ride({ id: "a", last_done: lastDone, original_air_time: airTime })]), GENERATED_AT);

    expect(html).toContain(`<span class="dlabel">Released</span>${label(airTime)}`);
    expect(html).toContain(`<span class="dlabel">Last done</span>${label(lastDone)}`);
  });

  it("shows a 'Never done' badge and no last-done date when the ride was never completed", () => {
    const airTime = 1_657_540_800;
    const html = renderReport(bucketsWith(30, [ride({ id: "n", last_done: null, original_air_time: airTime })]), GENERATED_AT);

    expect(html).toContain(`<span class="dlabel">Released</span>${label(airTime)}`);
    expect(html).toContain(`<span class="never">Never done</span>`);
    expect(html).not.toContain("Last done");
  });

  it("omits the release date when the ride has no original air time", () => {
    const lastDone = 1_659_312_000;
    const html = renderReport(bucketsWith(30, [ride({ id: "r", last_done: lastDone, original_air_time: null })]), GENERATED_AT);

    expect(html).not.toContain("Released");
    expect(html).toContain(`<span class="dlabel">Last done</span>${label(lastDone)}`);
  });
});

describe("renderReport tabs", () => {
  it("marks the 20-min tab active and every other tab inactive", () => {
    const html = renderReport(bucketsWith(20, [ride({ id: "a" })]), GENERATED_AT);

    expect(html).toContain(`id="tab-20" data-bucket="20" aria-controls="panel-20" aria-selected="true" tabindex="0"`);
    expect(html).toContain(`id="tab-30" data-bucket="30" aria-controls="panel-30" aria-selected="false" tabindex="-1"`);
  });

  it("shows only the first panel and hides the rest", () => {
    const html = renderReport(bucketsWith(20, [ride({ id: "a" })]), GENERATED_AT);

    expect(html).toContain(`id="panel-20" role="tabpanel" aria-labelledby="tab-20" data-bucket="20">`);
    expect(html).toContain(`id="panel-30" role="tabpanel" aria-labelledby="tab-30" data-bucket="30" hidden>`);
  });

  it("labels each tab with its ride count", () => {
    const html = renderReport(
      bucketsWith(45, [ride({ id: "a" }), ride({ id: "b" }), ride({ id: "c" })]),
      GENERATED_AT,
    );

    expect(html).toContain(`id="tab-45" data-bucket="45" aria-controls="panel-45" aria-selected="false" tabindex="-1">45 min <span class="count">3</span>`);
    expect(html).toContain(`>20 min <span class="count">0</span>`);
  });
});
