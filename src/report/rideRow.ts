import type { FavoriteWithLastDone } from "./rankFavorites.js";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Format a Unix epoch-seconds timestamp as a short absolute date (e.g. "Jul 11, 2022"). */
export function formatDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * "Last done" cell: the ride's release (air) date on top, and the date you last
 * completed it — or a "Never done" badge — below. Each value carries a short
 * label so it's clear which date is which.
 */
function renderLastDone(originalAirTime: number | null, lastDone: number | null): string {
  const dateHtml =
    originalAirTime === null
      ? ""
      : `<span class="date"><span class="dlabel">Released</span>${escapeHtml(formatDate(originalAirTime))}</span>`;

  if (lastDone === null) {
    return `${dateHtml}<span class="never">Never done</span>`;
  }

  return `${dateHtml}<span class="age"><span class="dlabel">Last done</span>${escapeHtml(formatDate(lastDone))}</span>`;
}

/**
 * One ride row: rank, title/instructor, an optional view-specific cell, the
 * release and last-done dates, and the stack button. Both the "Rides to Do
 * Next" lists and the records leaderboards render through here so a ride looks
 * the same wherever it appears.
 */
export function renderRide(ride: FavoriteWithLastDone, position: number, extraCell = "", rowClass = ""): string {
  const title = escapeHtml(ride.title ?? "Untitled ride");
  const instructor = ride.instructor_name ? escapeHtml(ride.instructor_name) : "—";
  const neverClass = ride.last_done === null ? " item--never" : "";
  const modifier = rowClass === "" ? "" : ` ${rowClass}`;
  const button = ride.join_token
    ? `<button class="stack-btn" data-join-token="${escapeHtml(ride.join_token)}" data-title="${title}">+ Stack</button>`
    : `<button class="stack-btn" disabled title="No on-demand class token available">—</button>`;

  return `
        <li class="item${neverClass}${modifier}">
          <span class="rank">${position}</span>
          <span class="ride">
            <span class="ride-title">${title}</span>
            <span class="ride-instructor">${instructor}</span>
          </span>${extraCell}
          <span class="last-done">${renderLastDone(ride.original_air_time, ride.last_done)}</span>
          ${button}
        </li>`;
}
