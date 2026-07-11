import { describe, expect, it } from "vitest";
import { isLastPage } from "../src/sync/pagination.js";

describe("isLastPage", () => {
  it("continues paging when a full page is returned", () => {
    expect(isLastPage(25, 25)).toBe(false);
  });

  it("stops when a short page is returned", () => {
    expect(isLastPage(10, 25)).toBe(true);
  });

  it("stops when an empty page is returned", () => {
    expect(isLastPage(0, 25)).toBe(true);
  });
});
