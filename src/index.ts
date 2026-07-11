import { logger } from "./logger.js";
import { syncWorkouts } from "./sync/syncWorkouts.js";

try {
  await syncWorkouts();
} catch (error) {
  logger.error({ err: error }, "Peloton sync failed");
  process.exitCode = 1;
}
