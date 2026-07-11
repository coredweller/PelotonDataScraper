import { BUCKET_MINUTES, type BucketMinutes, type FavoriteWithLastDone, type RankedBuckets } from "./rankFavorites.js";

const SECONDS_PER_DAY = 86_400;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Human-readable "last done" cell: an absolute date plus relative age, or a "Never done" badge. */
function renderLastDone(lastDone: number | null, now: Date): string {
  if (lastDone === null) {
    return `<span class="never">Never done</span>`;
  }

  const date = new Date(lastDone * 1000);
  const dateLabel = date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const daysAgo = Math.floor((now.getTime() / 1000 - lastDone) / SECONDS_PER_DAY);
  const ageLabel = daysAgo <= 0 ? "today" : daysAgo === 1 ? "1 day ago" : `${daysAgo} days ago`;

  return `<span class="date">${escapeHtml(dateLabel)}</span><span class="age">${escapeHtml(ageLabel)}</span>`;
}

function renderRide(ride: FavoriteWithLastDone, position: number, now: Date): string {
  const title = escapeHtml(ride.title ?? "Untitled ride");
  const instructor = ride.instructor_name ? escapeHtml(ride.instructor_name) : "—";
  const neverClass = ride.last_done === null ? " item--never" : "";

  return `
        <li class="item${neverClass}">
          <span class="rank">${position}</span>
          <span class="ride">
            <span class="ride-title">${title}</span>
            <span class="ride-instructor">${instructor}</span>
          </span>
          <span class="last-done">${renderLastDone(ride.last_done, now)}</span>
        </li>`;
}

function renderBucket(minutes: BucketMinutes, rides: FavoriteWithLastDone[], now: Date): string {
  const body =
    rides.length === 0
      ? `<li class="empty">No favorite cycling rides at this length.</li>`
      : rides.map((ride, index) => renderRide(ride, index + 1, now)).join("");

  return `
    <section class="bucket">
      <h2>${minutes} min <span class="count">${rides.length}</span></h2>
      <ol class="rides">${body}
      </ol>
    </section>`;
}

/**
 * Render the four ranked buckets into a single self-contained, theme-aware HTML
 * document (all CSS inline, no external assets). Each list is ordered so the
 * ride to do next — never done, or done furthest in the past — is at the top.
 */
export function renderReport(buckets: RankedBuckets, generatedAt: Date): string {
  const generatedLabel = generatedAt.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const sections = BUCKET_MINUTES.map((minutes) => renderBucket(minutes, buckets[minutes], generatedAt)).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Peloton — Rides to Do Next</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f5f5f7;
      --card: #ffffff;
      --text: #1d1d1f;
      --muted: #6e6e73;
      --border: #e2e2e6;
      --accent: #e63946;
      --never-bg: #e6394611;
      --row-alt: #00000005;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #000000;
        --card: #1c1c1e;
        --text: #f5f5f7;
        --muted: #98989d;
        --border: #2c2c2e;
        --accent: #ff6b78;
        --never-bg: #ff6b7818;
        --row-alt: #ffffff08;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 2rem 1.25rem 3rem;
      background: var(--bg);
      color: var(--text);
      font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    header { margin: 0 0 1.5rem; }
    h1 { font-size: 1.6rem; margin: 0 0 0.25rem; }
    .subtitle { color: var(--muted); margin: 0; font-size: 0.9rem; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 1.25rem;
      align-items: start;
    }
    .bucket {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1rem 1.1rem 1.25rem;
    }
    .bucket h2 {
      font-size: 1.05rem;
      margin: 0 0 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .count {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--muted);
      background: var(--row-alt);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.05rem 0.5rem;
    }
    ol.rides { list-style: none; margin: 0; padding: 0; counter-reset: none; }
    .item {
      display: grid;
      grid-template-columns: 1.75rem 1fr auto;
      align-items: center;
      gap: 0.6rem;
      padding: 0.55rem 0.4rem;
      border-radius: 8px;
    }
    .item:nth-child(even) { background: var(--row-alt); }
    .item--never { background: var(--never-bg); }
    .rank { color: var(--muted); font-variant-numeric: tabular-nums; text-align: right; font-size: 0.85rem; }
    .ride { display: flex; flex-direction: column; min-width: 0; }
    .ride-title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ride-instructor { color: var(--muted); font-size: 0.82rem; }
    .last-done { display: flex; flex-direction: column; text-align: right; white-space: nowrap; }
    .date { font-size: 0.85rem; }
    .age { color: var(--muted); font-size: 0.78rem; }
    .never {
      color: var(--accent);
      font-weight: 600;
      font-size: 0.82rem;
    }
    .empty { color: var(--muted); font-size: 0.88rem; padding: 0.5rem 0.4rem; list-style: none; }
  </style>
</head>
<body>
  <header>
    <h1>Rides to Do Next</h1>
    <p class="subtitle">Favorite cycling rides, least-recently-done first · generated ${escapeHtml(generatedLabel)}</p>
  </header>
  <main class="grid">${sections}
  </main>
</body>
</html>
`;
}
