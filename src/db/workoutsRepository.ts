import type Database from "better-sqlite3";
import { logger } from "../logger.js";
import { fail, ok, type Result } from "../result.js";

export interface WorkoutRow {
  id: string;
  started_at: number;
  discipline: string | null;
  fitness_discipline: string | null;
  title: string | null;
  instructor_name: string | null;
  duration_seconds: number | null;
  total_work_kj: number | null;
  distance_miles: number | null;
  calories: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  difficulty_rating: number | null;
  status: string | null;
  raw_json: string;
  synced_at: number;
}

export class WorkoutsRepository {
  constructor(private readonly db: Database.Database) {}

  isEmpty(): boolean {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM workouts").get() as { count: number };
    return row.count === 0;
  }

  upsertWorkout(row: WorkoutRow): Result<{ inserted: boolean }> {
    try {
      const statement = this.db.prepare(`
        INSERT OR IGNORE INTO workouts (
          id, started_at, discipline, fitness_discipline, title, instructor_name,
          duration_seconds, total_work_kj, distance_miles, calories,
          avg_heart_rate, max_heart_rate, difficulty_rating, status, raw_json, synced_at
        ) VALUES (
          @id, @started_at, @discipline, @fitness_discipline, @title, @instructor_name,
          @duration_seconds, @total_work_kj, @distance_miles, @calories,
          @avg_heart_rate, @max_heart_rate, @difficulty_rating, @status, @raw_json, @synced_at
        )
      `);
      const result = statement.run(row);
      return ok({ inserted: result.changes > 0 });
    } catch (error) {
      logger.error({ err: error, workoutId: row.id }, "Failed to upsert workout");
      return fail(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
