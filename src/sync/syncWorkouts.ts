import { config } from "../config.js";
import { AuthStateRepository } from "../db/authStateRepository.js";
import { openDatabase } from "../db/connection.js";
import { FavoriteRidesRepository } from "../db/favoriteRidesRepository.js";
import { InstructorsRepository } from "../db/instructorsRepository.js";
import { WorkoutsRepository } from "../db/workoutsRepository.js";
import { logger } from "../logger.js";
import { authenticate } from "../peloton/auth.js";
import { PelotonClient } from "../peloton/client.js";
import type { Instructor, RideSummary, WorkoutSummary } from "../peloton/types.js";
import { mapFavoriteRide } from "./mapFavoriteRide.js";
import { mapInstructor } from "./mapInstructor.js";
import { mapWorkout } from "./mapWorkout.js";
import { isLastPage } from "./pagination.js";

const BACKFILL_PAGE_SIZE = 25;
const FAVORITES_PAGE_SIZE = 50;
const INSTRUCTORS_PAGE_SIZE = 50;

async function fetchFavoriteRides(client: PelotonClient): Promise<RideSummary[]> {
  const rides: RideSummary[] = [];
  let page = 0;
  for (;;) {
    const response = await client.getFavoriteRides(page, FAVORITES_PAGE_SIZE);
    rides.push(...response.data);
    if (isLastPage(response.data.length, FAVORITES_PAGE_SIZE)) {
      break;
    }
    page += 1;
  }
  return rides;
}

async function fetchInstructors(client: PelotonClient): Promise<Instructor[]> {
  const instructors: Instructor[] = [];
  let page = 0;
  for (;;) {
    const response = await client.getInstructors(page, INSTRUCTORS_PAGE_SIZE);
    instructors.push(...response.data);
    if (isLastPage(response.data.length, INSTRUCTORS_PAGE_SIZE)) {
      break;
    }
    page += 1;
  }
  return instructors;
}

export async function syncWorkouts(): Promise<void> {
  const db = openDatabase();
  const repository = new WorkoutsRepository(db);
  const authStateRepository = new AuthStateRepository(db);
  const favoriteRidesRepository = new FavoriteRidesRepository(db);
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

  const favoriteRides = await fetchFavoriteRides(client);
  const favoriteRideRows = favoriteRides.map((ride) => mapFavoriteRide(ride, syncedAt));
  const favoritesResult = favoriteRidesRepository.replaceAll(favoriteRideRows);
  if (!favoritesResult.ok) {
    logger.error({ err: favoritesResult.error }, "Failed to sync favorite rides");
  } else {
    logger.info({ count: favoritesResult.value.count }, "Favorite rides synced");
  }

  const instructors = await fetchInstructors(client);
  const instructorRows = instructors.map((instructor) => mapInstructor(instructor, syncedAt));
  const instructorsResult = instructorsRepository.replaceAll(instructorRows);
  if (!instructorsResult.ok) {
    logger.error({ err: instructorsResult.error }, "Failed to sync instructors");
  } else {
    logger.info({ count: instructorsResult.value.count }, "Instructors synced");
  }

  db.close();
}
