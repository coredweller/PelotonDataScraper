import { BUCKET_MINUTES, type BucketMinutes, type FavoriteWithLastDone, type RankedBuckets } from "./rankFavorites.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Format a Unix epoch-seconds timestamp as a short absolute date (e.g. "Jul 11, 2022"). */
function formatDate(epochSeconds: number): string {
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

function renderRide(ride: FavoriteWithLastDone, position: number): string {
  const title = escapeHtml(ride.title ?? "Untitled ride");
  const instructor = ride.instructor_name ? escapeHtml(ride.instructor_name) : "—";
  const neverClass = ride.last_done === null ? " item--never" : "";
  const button = ride.join_token
    ? `<button class="stack-btn" data-join-token="${escapeHtml(ride.join_token)}" data-title="${title}">+ Stack</button>`
    : `<button class="stack-btn" disabled title="No on-demand class token available">—</button>`;

  return `
        <li class="item${neverClass}">
          <span class="rank">${position}</span>
          <span class="ride">
            <span class="ride-title">${title}</span>
            <span class="ride-instructor">${instructor}</span>
          </span>
          <span class="last-done">${renderLastDone(ride.original_air_time, ride.last_done)}</span>
          ${button}
        </li>`;
}

/** One selector button per bucket; the first is active by default. */
function renderTab(minutes: BucketMinutes, count: number, active: boolean): string {
  return `
        <button class="tab${active ? " active" : ""}" role="tab" id="tab-${minutes}" data-bucket="${minutes}" aria-controls="panel-${minutes}" aria-selected="${active}">${minutes} min <span class="count">${count}</span></button>`;
}

/** One bucket's ride list as a tab panel; only the active panel is shown. */
function renderBucket(minutes: BucketMinutes, rides: FavoriteWithLastDone[], active: boolean): string {
  const body =
    rides.length === 0
      ? `<li class="empty">No favorite cycling rides at this length.</li>`
      : rides.map((ride, index) => renderRide(ride, index + 1)).join("");

  return `
    <section class="bucket" id="panel-${minutes}" role="tabpanel" aria-labelledby="tab-${minutes}" data-bucket="${minutes}"${active ? "" : " hidden"}>
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
  const tabs = BUCKET_MINUTES.map((minutes, index) => renderTab(minutes, buckets[minutes].length, index === 0)).join("");
  const sections = BUCKET_MINUTES.map((minutes, index) =>
    renderBucket(minutes, buckets[minutes], index === 0),
  ).join("");

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
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin: 0 0 1.25rem;
    }
    .tab {
      font: inherit;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      color: var(--muted);
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.4rem 0.9rem;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: background 0.12s, color 0.12s, border-color 0.12s;
    }
    .tab:hover { color: var(--text); }
    .tab.active { color: #fff; background: var(--accent); border-color: var(--accent); }
    .tab.active .count { color: #fff; background: #ffffff2a; border-color: transparent; }
    main { display: block; }
    .bucket {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1rem 1.1rem 1.25rem;
    }
    .bucket[hidden] { display: none; }
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
      grid-template-columns: 1.75rem 1fr auto auto;
      align-items: center;
      gap: 0.6rem;
      padding: 0.55rem 0.4rem;
      border-radius: 8px;
    }
    .stack-btn {
      font: inherit;
      font-size: 0.8rem;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
      color: var(--accent);
      background: transparent;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.2rem 0.6rem;
      transition: background 0.12s, color 0.12s;
    }
    .stack-btn:hover:not(:disabled) { background: var(--accent); color: #fff; border-color: var(--accent); }
    .stack-btn:disabled { color: var(--muted); cursor: default; opacity: 0.55; }
    .stack-btn.stacked { color: #1a7f37; border-color: #1a7f3755; background: #1a7f3714; cursor: default; }
    .stack-btn.failed { color: #b3261e; border-color: #b3261e55; }
    .item:nth-child(even) { background: var(--row-alt); }
    .item--never { background: var(--never-bg); }
    .rank { color: var(--muted); font-variant-numeric: tabular-nums; text-align: right; font-size: 0.85rem; }
    .ride { display: flex; flex-direction: column; min-width: 0; }
    .ride-title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ride-instructor { color: var(--muted); font-size: 0.82rem; }
    .last-done { display: flex; flex-direction: column; text-align: right; white-space: nowrap; }
    .date { font-size: 0.85rem; }
    .age { color: var(--muted); font-size: 0.78rem; }
    .dlabel {
      color: var(--muted);
      font-size: 0.62rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      margin-right: 0.35rem;
    }
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
    <p class="subtitle">Favorite cycling rides, least-recently-done first · generated ${escapeHtml(generatedLabel)}<span id="stack-status"></span></p>
  </header>
  <nav class="tabs" role="tablist" aria-label="Class length">${tabs}
  </nav>
  <main>${sections}
  </main>
  <script>
    (function () {
      var tabs = document.querySelectorAll(".tab");
      var panels = document.querySelectorAll(".bucket");
      tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
          var bucket = tab.dataset.bucket;
          tabs.forEach(function (t) {
            var on = t.dataset.bucket === bucket;
            t.classList.toggle("active", on);
            t.setAttribute("aria-selected", on ? "true" : "false");
          });
          panels.forEach(function (p) {
            var on = p.dataset.bucket === bucket;
            p.classList.toggle("active", on);
            if (on) p.removeAttribute("hidden");
            else p.setAttribute("hidden", "");
          });
        });
      });
    })();
  </script>
  <script>
    (function () {
      var live = location.protocol === "http:" || location.protocol === "https:";
      var status = document.getElementById("stack-status");
      var buttons = document.querySelectorAll(".stack-btn[data-join-token]");

      if (!live) {
        // Static file opened directly — the API isn't reachable, so make that clear.
        buttons.forEach(function (b) {
          b.disabled = true;
          b.title = "Run 'npm run serve' and open the served page to stack rides";
        });
        if (status) status.textContent = " · open via 'npm run serve' to stack rides";
        return;
      }

      function showCount(n) {
        if (status && typeof n === "number") status.textContent = " · your stack: " + n + " class" + (n === 1 ? "" : "es");
      }

      fetch("/api/stack").then(function (r) { return r.json(); }).then(function (d) { showCount(d.numClasses); }).catch(function () {});

      document.addEventListener("click", function (e) {
        var btn = e.target.closest && e.target.closest(".stack-btn[data-join-token]");
        if (!btn || btn.disabled || btn.classList.contains("stacked")) return;
        var original = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Adding…";
        fetch("/api/stack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ joinToken: btn.dataset.joinToken })
        }).then(function (r) {
          return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "failed"); return d; });
        }).then(function (d) {
          btn.textContent = "Stacked ✓";
          btn.classList.add("stacked");
          showCount(d.numClasses);
        }).catch(function (err) {
          btn.textContent = "Retry";
          btn.disabled = false;
          btn.classList.add("failed");
          btn.title = String(err.message || err);
        });
      });
    })();
  </script>
</body>
</html>
`;
}
