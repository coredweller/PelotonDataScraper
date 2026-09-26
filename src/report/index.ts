import { writeFileSync } from "node:fs";
import { logger } from "../logger.js";
import { queryFavorites, queryUnfavoritedHipHop90s } from "./queryFavorites.js";
import { BUCKET_MINUTES, rankFavorites } from "./rankFavorites.js";
import { queryCompletedRides } from "./queryRecords.js";
import { rankRecords } from "./rankRecords.js";
import { renderReport } from "./renderReport.js";

const OUTPUT_PATH = "./peloton-report.html";

try {
  logger.info("Generating favorites report");

  const buckets = rankFavorites(queryFavorites());
  const records = rankRecords(queryCompletedRides());
  const hipHop90s = queryUnfavoritedHipHop90s();
  const html = renderReport(buckets, records, hipHop90s, new Date());
  writeFileSync(OUTPUT_PATH, html, "utf-8");

  const counts = Object.fromEntries(BUCKET_MINUTES.map((minutes) => [minutes, buckets[minutes].length]));
  logger.info(
    { output: OUTPUT_PATH, counts, ridesAnalysed: records.stats.totalRides, unfavoritedHipHop90s: hipHop90s.length },
    "Report generated",
  );
} catch (error) {
  logger.error({ err: error }, "Report generation failed");
  process.exitCode = 1;
}
