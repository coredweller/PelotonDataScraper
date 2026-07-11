import type Database from "better-sqlite3";
import { logger } from "../logger.js";
import { fail, ok, type Result } from "../result.js";

export interface FavoriteRideRow {
  id: string;
  title: string | null;
  instructor_id: string | null;
  fitness_discipline: string | null;
  duration_seconds: number | null;
  difficulty_rating: number | null;
  original_air_time: number | null;
  raw_json: string;
  synced_at: number;
}

export class FavoriteRidesRepository {
  constructor(private readonly db: Database.Database) {}

  // Favorites are a live "current state" list from the API (unfavoriting removes a ride from it),
  // so each sync replaces the table wholesale rather than upserting.
  replaceAll(rows: FavoriteRideRow[]): Result<{ count: number }> {
    try {
      const deleteAll = this.db.prepare("DELETE FROM favorite_rides");
      const insert = this.db.prepare(`
        INSERT INTO favorite_rides (
          id, title, instructor_id, fitness_discipline, duration_seconds,
          difficulty_rating, original_air_time, raw_json, synced_at
        ) VALUES (
          @id, @title, @instructor_id, @fitness_discipline, @duration_seconds,
          @difficulty_rating, @original_air_time, @raw_json, @synced_at
        )
      `);
      const replace = this.db.transaction((rides: FavoriteRideRow[]) => {
        deleteAll.run();
        for (const row of rides) {
          insert.run(row);
        }
      });
      replace(rows);
      return ok({ count: rows.length });
    } catch (error) {
      logger.error({ err: error }, "Failed to replace favorite rides");
      return fail(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
