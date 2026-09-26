import { config } from "../config.js";
import { AuthStateRepository } from "../db/authStateRepository.js";
import { openDatabase } from "../db/connection.js";
import { InstructorsRepository } from "../db/instructorsRepository.js";
import { RidesRepository } from "../db/ridesRepository.js";
import { WorkoutsRepository } from "../db/workoutsRepository.js";
import { logger } from "../logger.js";
import { authenticate } from "../peloton/auth.js";
import { PelotonClient } from "../peloton/client.js";
import type { WorkoutSummary } from "../peloton/types.js";
import { selectUnfavoritedHipHop90s } from "./hipHop90s.js";
import { mapInstructor } from "./mapInstructor.js";
import { mapRide } from "./mapRide.js";
import { mapWorkout } from "./mapWorkout.js";
import { fetchAllPages, isLastPage } from "./pagination.js";

const BACKFILL_PAGE_SIZE = 25;
const FAVORITES_PAGE_SIZE = 50;
const INSTRUCTORS_PAGE_SIZE = 50;
// The archived-ride endpoint caps pages at 100 even when asked for more, so a
// larger size would make the first page look short and end paging early.
const HIP_HOP_PAGE_SIZE = 100;

export async function syncWorkouts(): Promise<void> {
  const db = openDatabase();
  const repository = new WorkoutsRepository(db);
  const authStateRepository = new AuthStateRepository(db);
  const favoriteRidesRepository = new RidesRepository(db, "favorite_rides");
  const hipHop90sRidesRepository = new RidesRepository(db, "hip_hop_90s_rides");
  const instructorsRepository = new InstructorsRepository(db);

  const auth = await authenticate(config.PELOTON_USERNAME, config.PELOTON_PASSWORD, authStateRepository.get());
  authStateRepository.save(auth);
  const client = new PelotonClient(auth);

  const backfill = repository.isEmpty();
  logger.info({ mode: backfill ? "backfill" : "incremental" }, "Starting Peloton sync");

  const summaries: WorkoutSummary[] = [];

  if (backfill) {
    let page = 0;
    for (;;) {
      const response = await client.getWorkouts(page, BACKFILL_PAGE_SIZE);
      summaries.push(...response.data);
      if (isLastPage(response.data.length, BACKFILL_PAGE_SIZE)) {
        break;
      }
      page += 1;
    }
  } else {
    const response = await client.getWorkouts(0, config.SYNC_RECENT_COUNT);
    summaries.push(...response.data);
  }

  let inserted = 0;
  let skipped = 0;
  const syncedAt = Math.floor(Date.now() / 1000);

  for (const summary of summaries) {
    const detail = await client.getWorkoutDetail(summary.id);
    const row = mapWorkout(detail, syncedAt);
    const result = repository.upsertWorkout(row);

    if (!result.ok) {
      logger.error({ workoutId: summary.id, err: result.error }, "Skipping workout after upsert failure");
      continue;
    }

    if (result.value.inserted) {
      inserted += 1;
    } else {
      skipped += 1;
    }
  }

  logger.info({ fetched: summaries.length, inserted, skipped }, "Peloton sync complete");

  const favoriteRides = await fetchAllPages((page, limit) => client.getFavoriteRides(page, limit), FAVORITES_PAGE_SIZE);
  const favoriteRideRows = favoriteRides.map((ride) => mapRide(ride, syncedAt));
  const favoritesResult = favoriteRidesRepository.replaceAll(favoriteRideRows);
  if (!favoritesResult.ok) {
    logger.error({ err: favoritesResult.error }, "Failed to sync favorite rides");
  } else {
    logger.info({ count: favoritesResult.value.count }, "Favorite rides synced");
  }

  const hipHopRides = await fetchAllPages((page, limit) => client.getHipHopCyclingRides(page, limit), HIP_HOP_PAGE_SIZE);
  const hipHop90sRows = selectUnfavoritedHipHop90s(hipHopRides).map((ride) => mapRide(ride, syncedAt));
  const hipHop90sResult = hipHop90sRidesRepository.replaceAll(hipHop90sRows);
  if (!hipHop90sResult.ok) {
    logger.error({ err: hipHop90sResult.error }, "Failed to sync unfavorited 90s Hip Hop rides");
  } else {
    logger.info(
      { scanned: hipHopRides.length, unfavorited: hipHop90sResult.value.count },
      "Unfavorited 90s Hip Hop rides synced",
    );
  }

  const instructors = await fetchAllPages((page, limit) => client.getInstructors(page, limit), INSTRUCTORS_PAGE_SIZE);
  const instructorRows = instructors.map((instructor) => mapInstructor(instructor, syncedAt));
  const instructorsResult = instructorsRepository.replaceAll(instructorRows);
  if (!instructorsResult.ok) {
    logger.error({ err: instructorsResult.error }, "Failed to sync instructors");
  } else {
    logger.info({ count: instructorsResult.value.count }, "Instructors synced");
  }

  db.close();
}
