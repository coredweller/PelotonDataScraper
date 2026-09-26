import type Database from "better-sqlite3";
import { logger } from "../logger.js";
import { fail, ok, type Result } from "../result.js";

/** The tables that hold ride (class) snapshots; all share the same columns. */
export type RideTable = "favorite_rides" | "hip_hop_90s_rides";

export interface RideRow {
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

export class RidesRepository {
  constructor(
    private readonly db: Database.Database,
    private readonly table: RideTable,
  ) {}

  // Each ride table is a live "current state" list from the API (e.g. unfavoriting removes a ride
  // from favorites), so each sync replaces the table wholesale rather than upserting.
  replaceAll(rows: RideRow[]): Result<{ count: number }> {
    try {
      const deleteAll = this.db.prepare(`DELETE FROM ${this.table}`);
      const insert = this.db.prepare(`
        INSERT INTO ${this.table} (
          id, title, instructor_id, fitness_discipline, duration_seconds,
          difficulty_rating, original_air_time, raw_json, synced_at
        ) VALUES (
          @id, @title, @instructor_id, @fitness_discipline, @duration_seconds,
          @difficulty_rating, @original_air_time, @raw_json, @synced_at
        )
      `);
      const replace = this.db.transaction((rides: RideRow[]) => {
        deleteAll.run();
        for (const row of rides) {
          insert.run(row);
        }
      });
      replace(rows);
      return ok({ count: rows.length });
    } catch (error) {
      logger.error({ err: error, table: this.table }, "Failed to replace rides");
      return fail(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
