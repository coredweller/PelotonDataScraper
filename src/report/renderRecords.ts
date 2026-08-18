import { BUCKET_MINUTES, type BucketMinutes } from "./rankFavorites.js";
import { RECORDS_PER_BUCKET, type OutputRecord, type RideRecords, type RideStats } from "./rankRecords.js";
import { escapeHtml, formatDate, renderRide } from "./rideRow.js";

/** Styles used only by the records view; the page shell concatenates them. */
export const RECORDS_STYLES = `
    .tiles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
      gap: 0.75rem;
      margin: 0 0 1.5rem;
    }
    .tile { padding: 0.85rem 1rem; }
    .tile-label {
      display: block;
      color: var(--muted);
      font-size: 0.68rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .tile-value {
      display: block;
      font-size: 1.4rem;
      font-weight: 700;
      line-height: 1.25;
      margin-top: 0.2rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tile-note { display: block; color: var(--muted); font-size: 0.75rem; }
    .record-group { margin: 0 0 1rem; }
    .record-group h3 {
      font-size: 0.95rem;
      margin: 0 0 0.4rem;
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
    }
    .record-group h3 .pr { color: var(--muted); font-size: 0.75rem; font-weight: 500; }
    .rides--records .item { grid-template-columns: 1.75rem 1fr auto auto auto; }
    .output { display: flex; flex-direction: column; text-align: right; white-space: nowrap; }
    .output-kj { font-weight: 700; font-variant-numeric: tabular-nums; }
    .output-watts { color: var(--muted); font-size: 0.78rem; font-variant-numeric: tabular-nums; }
    .item--record .output-kj { color: var(--accent); }
    .section-heading { font-size: 1.05rem; margin: 0 0 0.15rem; }
    .section-note { color: var(--muted); font-size: 0.82rem; margin: 0 0 0.9rem; }`;

function formatInteger(value: number): string {
  return Math.round(value).toLocaleString();
}

/** Whole hours of saddle time — the number is large enough that minutes are noise. */
function formatHours(seconds: number): string {
  return `${formatInteger(seconds / 3600)} h`;
}

function renderTile(labelText: string, value: string, note = ""): string {
  const noteHtml = note === "" ? "" : `<span class="tile-note">${escapeHtml(note)}</span>`;
  return `
      <div class="card tile">
        <span class="tile-label">${escapeHtml(labelText)}</span>
        <span class="tile-value">${escapeHtml(value)}</span>${noteHtml}
      </div>`;
}

function renderTiles(stats: RideStats): string {
  const since =
    stats.firstRideAt === null
      ? ""
      : `since ${new Date(stats.firstRideAt * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short" })}`;

  return [
    renderTile("Rides", formatInteger(stats.totalRides), since),
    renderTile(
      "Distinct classes",
      formatInteger(stats.uniqueRides),
      `${formatInteger(stats.totalRides - stats.uniqueRides)} repeats`,
    ),
    renderTile("Total output", `${formatInteger(stats.totalOutputKj)} kJ`),
    renderTile("Time on the bike", formatHours(stats.totalSeconds)),
    renderTile("Best ride output", stats.bestOutputKj === null ? "—" : `${formatInteger(stats.bestOutputKj)} kJ`),
    renderTile("Best avg output", stats.bestAverageWatts === null ? "—" : `${formatInteger(stats.bestAverageWatts)} W`),
    renderTile(
      "Top instructor",
      stats.topInstructor === null ? "—" : stats.topInstructor.name,
      stats.topInstructor === null ? "" : `${formatInteger(stats.topInstructor.rides)} rides`,
    ),
  ].join("");
}

/** The output cell: total kJ with the average watts it works out to underneath. */
function renderOutputCell(record: OutputRecord): string {
  const watts =
    record.duration_seconds === null || record.duration_seconds <= 0
      ? ""
      : `<span class="output-watts">${formatInteger((record.output_kj * 1000) / record.duration_seconds)} W avg</span>`;

  return `
          <span class="output">
            <span class="output-kj">${formatInteger(record.output_kj)} kJ</span>${watts}
          </span>`;
}

function renderRecordGroup(minutes: BucketMinutes, records: OutputRecord[]): string {
  if (records.length === 0) {
    return `
      <section class="card record-group">
        <h3>${minutes} min</h3>
        <p class="section-note">No completed rides at this length yet.</p>
      </section>`;
  }

  const best = records[0];
  const rows = records
    .map((record, index) => renderRide(record, index + 1, renderOutputCell(record), index === 0 ? "item--record" : ""))
    .join("");

  return `
      <section class="card record-group">
        <h3>${minutes} min <span class="pr">PR ${formatInteger(best.output_kj)} kJ on ${escapeHtml(formatDate(best.achieved_at))}</span></h3>
        <ol class="rides rides--records">${rows}
        </ol>
      </section>`;
}

/**
 * The records view: headline stats across all completed cycling rides, then a
 * highest-output leaderboard for each class length with the record ride first.
 */
export function renderRecords(records: RideRecords): string {
  const groups = BUCKET_MINUTES.map((minutes) => renderRecordGroup(minutes, records.buckets[minutes])).join("");

  return `
    <div class="tiles">${renderTiles(records.stats)}
    </div>
    <h2 class="section-heading">Highest output by class length</h2>
    <p class="section-note">Your personal best on each ride — top ${RECORDS_PER_BUCKET} per length, record first.</p>
    ${groups}`;
}
