import type Database from "better-sqlite3";
import type { AuthState } from "../peloton/auth.js";

export class AuthStateRepository {
  constructor(private readonly db: Database.Database) {}

  get(): AuthState | null {
    const row = this.db
      .prepare("SELECT access_token, refresh_token, user_id, expires_at FROM auth_state WHERE id = 1")
      .get() as { access_token: string; refresh_token: string | null; user_id: string; expires_at: number } | undefined;

    if (!row) return null;

    return {
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      userId: row.user_id,
      expiresAt: row.expires_at,
    };
  }

  save(state: AuthState): void {
    this.db
      .prepare(`
        INSERT INTO auth_state (id, access_token, refresh_token, user_id, expires_at)
        VALUES (1, @accessToken, @refreshToken, @userId, @expiresAt)
        ON CONFLICT(id) DO UPDATE SET
          access_token = excluded.access_token,
          refresh_token = excluded.refresh_token,
          user_id = excluded.user_id,
          expires_at = excluded.expires_at
      `)
      .run(state);
  }
}
