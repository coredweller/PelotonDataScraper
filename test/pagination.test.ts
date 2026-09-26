import { describe, expect, it } from "vitest";
import { fetchAllPages, isLastPage } from "../src/sync/pagination.js";

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

describe("fetchAllPages", () => {
  /** A fake paged endpoint over `total` numbered items, recording each page requested. */
  function endpoint(total: number) {
    const requested: number[] = [];
    const fetchPage = async (page: number, limit: number) => {
      requested.push(page);
      const start = page * limit;
      return { data: Array.from({ length: Math.max(0, Math.min(limit, total - start)) }, (_, i) => start + i) };
    };
    return { fetchPage, requested };
  }

  it("collects every item across pages and stops on the short page", async () => {
    const { fetchPage, requested } = endpoint(5);

    expect(await fetchAllPages(fetchPage, 2)).toEqual([0, 1, 2, 3, 4]);
    expect(requested).toEqual([0, 1, 2]);
  });

  it("requests one extra empty page when the total is an exact multiple of the page size", async () => {
    const { fetchPage, requested } = endpoint(4);

    expect(await fetchAllPages(fetchPage, 2)).toEqual([0, 1, 2, 3]);
    expect(requested).toEqual([0, 1, 2]);
  });

  it("propagates a failed page request", async () => {
    await expect(fetchAllPages(() => Promise.reject(new Error("boom")), 2)).rejects.toThrow("boom");
  });
});
