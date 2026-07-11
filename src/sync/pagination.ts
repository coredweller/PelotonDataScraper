export function isLastPage(receivedCount: number, pageSize: number): boolean {
  return receivedCount < pageSize;
}
