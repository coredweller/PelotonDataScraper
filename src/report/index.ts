import { writeFileSync } from "node:fs";
import { logger } from "../logger.js";
import { queryFavorites } from "./queryFavorites.js";
import { BUCKET_MINUTES, rankFavorites } from "./rankFavorites.js";
import { queryCompletedRides } from "./queryRecords.js";
import { rankRecords } from "./rankRecords.js";
import { renderReport } from "./renderReport.js";

const OUTPUT_PATH = "./peloton-report.html";

try {
  logger.info("Generating favorites report");

  const buckets = rankFavorites(queryFavorites());
  const records = rankRecords(queryCompletedRides());
  const html = renderReport(buckets, records, new Date());
  writeFileSync(OUTPUT_PATH, html, "utf-8");

  const counts = Object.fromEntries(BUCKET_MINUTES.map((minutes) => [minutes, buckets[minutes].length]));
  logger.info({ output: OUTPUT_PATH, counts, ridesAnalysed: records.stats.totalRides }, "Report generated");
} catch (error) {
  logger.error({ err: error }, "Report generation failed");
  process.exitCode = 1;
}
