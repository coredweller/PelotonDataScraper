import { writeFileSync } from "node:fs";
import { logger } from "../logger.js";
import { queryFavorites } from "./queryFavorites.js";
import { BUCKET_MINUTES, rankFavorites } from "./rankFavorites.js";
import { renderReport } from "./renderReport.js";

const OUTPUT_PATH = "./peloton-report.html";

try {
  logger.info("Generating favorites report");

  const rows = queryFavorites();
  const buckets = rankFavorites(rows);
  const html = renderReport(buckets, new Date());
  writeFileSync(OUTPUT_PATH, html, "utf-8");

  const counts = Object.fromEntries(BUCKET_MINUTES.map((minutes) => [minutes, buckets[minutes].length]));
  logger.info({ output: OUTPUT_PATH, counts }, "Report generated");
} catch (error) {
  logger.error({ err: error }, "Report generation failed");
  process.exitCode = 1;
}
