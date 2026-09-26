import type { Paginated } from "../peloton/types.js";

export function isLastPage(receivedCount: number, pageSize: number): boolean {
  return receivedCount < pageSize;
}

/** Request pages from 0 upward until a short page signals the end, and return every item. */
export async function fetchAllPages<T>(
  fetchPage: (page: number, limit: number) => Promise<Paginated<T>>,
  pageSize: number,
): Promise<T[]> {
  const items: T[] = [];
  let page = 0;
  for (;;) {
    const response = await fetchPage(page, pageSize);
    items.push(...response.data);
    if (isLastPage(response.data.length, pageSize)) {
      return items;
    }
    page += 1;
  }
}
