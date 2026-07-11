import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";

export function openDatabase(): Database.Database {
  const db = new Database(config.DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const schemaPath = fileURLToPath(new URL("./schema.sql", import.meta.url));
  const schema = readFileSync(schemaPath, "utf-8");
  db.exec(schema);

  return db;
}
