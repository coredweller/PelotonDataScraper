import { BUCKET_MINUTES, type BucketMinutes, type FavoriteWithLastDone, type RankedBuckets } from "./rankFavorites.js";
import type { RideRecords } from "./rankRecords.js";
import { RECORDS_STYLES, renderRecords } from "./renderRecords.js";
import { escapeHtml, renderRide } from "./rideRow.js";

/** One selector button per bucket; the first is active by default. Roving tabindex: only the active tab is in the tab order. */
function renderTab(minutes: BucketMinutes, count: number, active: boolean): string {
  return `
        <button class="tab${active ? " active" : ""}" role="tab" id="tab-${minutes}" data-bucket="${minutes}" aria-controls="panel-${minutes}" aria-selected="${active}" tabindex="${active ? 0 : -1}">${minutes} min <span class="count">${count}</span></button>`;
}

/** One bucket's ride list as a tab panel; only the active panel is shown. */
function renderBucket(minutes: BucketMinutes, rides: FavoriteWithLastDone[], active: boolean): string {
  const body =
    rides.length === 0
      ? `<li class="empty">No favorite cycling rides at this length.</li>`
      : rides.map((ride, index) => renderRide(ride, index + 1)).join("");

  return `
      <section class="card bucket" id="panel-${minutes}" role="tabpanel" aria-labelledby="tab-${minutes}" data-bucket="${minutes}"${active ? "" : " hidden"}>
        <ol class="rides">${body}
        </ol>
      </section>`;
}

/** One of the two top-level views; "Rides to Do Next" is active by default. */
function renderViewTab(view: string, labelText: string, active: boolean): string {
  return `
      <button class="view-tab${active ? " active" : ""}" role="tab" id="view-tab-${view}" data-view="${view}" aria-controls="view-${view}" aria-selected="${active}" tabindex="${active ? 0 : -1}">${labelText}</button>`;
}

/**
 * Render both views into a single self-contained, theme-aware HTML document
 * (all CSS inline, no external assets): "Rides to Do Next", where each length's
 * list puts the ride to do next at the top, and "Records", which ranks
 * completed rides by output.
 */
export function renderReport(buckets: RankedBuckets, records: RideRecords, generatedAt: Date): string {
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
  <title>Peloton — Rides &amp; Records</title>
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
    header { margin: 0 0 1.25rem; }
    h1 { font-size: 1.6rem; margin: 0 0 0.25rem; }
    .subtitle { color: var(--muted); margin: 0; font-size: 0.9rem; }
    .views {
      display: inline-flex;
      gap: 0.25rem;
      margin: 0 0 1.25rem;
      padding: 0.25rem;
      background: var(--row-alt);
      border: 1px solid var(--border);
      border-radius: 999px;
    }
    .view-tab {
      font: inherit;
      font-size: 0.92rem;
      font-weight: 600;
      cursor: pointer;
      color: var(--muted);
      background: transparent;
      border: none;
      border-radius: 999px;
      padding: 0.4rem 1rem;
      transition: background 0.12s, color 0.12s;
    }
    .view-tab:hover { color: var(--text); }
    .view-tab.active { color: #fff; background: var(--accent); }
    .view[hidden] { display: none; }
    .view-note { color: var(--muted); font-size: 0.85rem; margin: 0 0 0.9rem; }
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
    .card {
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
    .empty { color: var(--muted); font-size: 0.88rem; padding: 0.5rem 0.4rem; list-style: none; }${RECORDS_STYLES}
  </style>
</head>
<body>
  <header>
    <h1>Peloton</h1>
    <p class="subtitle">Synced favorites and ride history · generated ${escapeHtml(generatedLabel)}<span id="stack-status"></span></p>
  </header>
  <nav class="views" role="tablist" aria-label="View">${renderViewTab("next", "Rides to Do Next", true)}${renderViewTab("records", "Records", false)}
  </nav>
  <main>
    <section class="view" id="view-next" role="tabpanel" aria-labelledby="view-tab-next" data-view="next">
      <p class="view-note">Favorite cycling rides, least-recently-done first.</p>
      <nav class="tabs" role="tablist" aria-label="Class length">${tabs}
      </nav>${sections}
    </section>
    <section class="view" id="view-records" role="tabpanel" aria-labelledby="view-tab-records" data-view="records" hidden>
      <p class="view-note">Every completed cycling ride, ranked by total output.</p>${renderRecords(records)}
    </section>
  </main>
  <script>
    (function () {
      var viewTabs = Array.prototype.slice.call(document.querySelectorAll(".view-tab"));
      var views = Array.prototype.slice.call(document.querySelectorAll(".view"));
      var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
      var panels = Array.prototype.slice.call(document.querySelectorAll(".bucket"));
      var currentView = "next";
      var currentBucket = "${BUCKET_MINUTES[0]}";

      // Remember both choices so a reload (npm run serve re-renders on each GET) lands back here.
      function syncHash() {
        var hash = "#" + (currentView === "records" ? "records" : currentBucket);
        if (history.replaceState) history.replaceState(null, "", hash);
        else location.hash = hash;
      }

      /** Mark the element whose data-[key] matches as active: tabs get ARIA state, panels get shown. */
      function activate(elements, key, value) {
        elements.forEach(function (el) {
          var on = el.dataset[key] === value;
          el.classList.toggle("active", on);
          if (el.getAttribute("role") === "tab") {
            el.setAttribute("aria-selected", on ? "true" : "false");
            el.tabIndex = on ? 0 : -1;
          } else if (on) {
            el.removeAttribute("hidden");
          } else {
            el.setAttribute("hidden", "");
          }
        });
      }

      function focusActive(elements, key, value) {
        var active = elements.filter(function (el) { return el.dataset[key] === value; })[0];
        if (active) active.focus();
      }

      function selectBucket(bucket, focus) {
        currentBucket = bucket;
        activate(tabs, "bucket", bucket);
        activate(panels, "bucket", bucket);
        if (focus) focusActive(tabs, "bucket", bucket);
        syncHash();
      }

      function selectView(view, focus) {
        currentView = view;
        activate(viewTabs, "view", view);
        activate(views, "view", view);
        if (focus) focusActive(viewTabs, "view", view);
        syncHash();
      }

      // Click plus arrow/Home/End roving focus, shared by both tablists.
      function wireTablist(elements, key, select) {
        elements.forEach(function (el, i) {
          el.addEventListener("click", function () { select(el.dataset[key]); });
          el.addEventListener("keydown", function (e) {
            var next;
            if (e.key === "ArrowRight") next = (i + 1) % elements.length;
            else if (e.key === "ArrowLeft") next = (i - 1 + elements.length) % elements.length;
            else if (e.key === "Home") next = 0;
            else if (e.key === "End") next = elements.length - 1;
            else return;
            e.preventDefault();
            select(elements[next].dataset[key], true);
          });
        });
      }

      wireTablist(tabs, "bucket", selectBucket);
      wireTablist(viewTabs, "view", selectView);

      // Restore the previous view/length from the URL hash, if it names a real one.
      var initial = (location.hash || "").replace("#", "");
      if (initial === "records") selectView("records");
      else if (initial && tabs.some(function (t) { return t.dataset.bucket === initial; })) selectBucket(initial);
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
