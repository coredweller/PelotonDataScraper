import type Database from "better-sqlite3";
import { logger } from "../logger.js";
import { fail, ok, type Result } from "../result.js";

export interface InstructorRow {
  id: string;
  name: string | null;
  raw_json: string;
  synced_at: number;
}

export class InstructorsRepository {
  constructor(private readonly db: Database.Database) {}

  // The API returns the full instructor roster each call, so each sync replaces the table
  // wholesale rather than upserting (consistent with FavoriteRidesRepository).
  replaceAll(rows: InstructorRow[]): Result<{ count: number }> {
    try {
      const deleteAll = this.db.prepare("DELETE FROM instructors");
      const insert = this.db.prepare(`
        INSERT INTO instructors (id, name, raw_json, synced_at)
        VALUES (@id, @name, @raw_json, @synced_at)
      `);
      const replace = this.db.transaction((instructors: InstructorRow[]) => {
        deleteAll.run();
        for (const row of instructors) {
          insert.run(row);
        }
      });
      replace(rows);
      return ok({ count: rows.length });
    } catch (error) {
      logger.error({ err: error }, "Failed to replace instructors");
      return fail(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
