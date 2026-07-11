import { describe, expect, it } from "vitest";
import { mapInstructor } from "../src/sync/mapInstructor.js";
import type { Instructor } from "../src/peloton/types.js";

describe("mapInstructor", () => {
  it("maps an instructor to a typed row", () => {
    const instructor: Instructor = { id: "instructor-1", name: "Robin Arzon" };

    const row = mapInstructor(instructor, 1_700_002_000);

    expect(row).toEqual({
      id: "instructor-1",
      name: "Robin Arzon",
      raw_json: JSON.stringify(instructor),
      synced_at: 1_700_002_000,
    });
  });

  it("falls back to null when name is missing", () => {
    const instructor: Instructor = { id: "instructor-2" };

    const row = mapInstructor(instructor, 1_700_100_500);

    expect(row.id).toBe("instructor-2");
    expect(row.name).toBeNull();
    expect(row.raw_json).toBe(JSON.stringify(instructor));
  });
});
