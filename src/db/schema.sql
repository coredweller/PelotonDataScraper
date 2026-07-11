CREATE TABLE IF NOT EXISTS workouts (
  id                 TEXT PRIMARY KEY,
  started_at         INTEGER NOT NULL,
  discipline         TEXT,
  fitness_discipline TEXT,
  title              TEXT,
  instructor_name    TEXT,
  duration_seconds   INTEGER,
  total_work_kj       REAL,
  distance_miles      REAL,
  calories            INTEGER,
  avg_heart_rate       INTEGER,
  max_heart_rate       INTEGER,
  difficulty_rating    REAL,
  status              TEXT,
  raw_json            TEXT NOT NULL,
  synced_at           INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workouts_started_at ON workouts(started_at);

CREATE TABLE IF NOT EXISTS favorite_rides (
  id                 TEXT PRIMARY KEY,
  title              TEXT,
  instructor_id      TEXT,
  fitness_discipline TEXT,
  duration_seconds   INTEGER,
  difficulty_rating  REAL,
  original_air_time  INTEGER,
  raw_json           TEXT NOT NULL,
  synced_at          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS instructors (
  id        TEXT PRIMARY KEY,
  name      TEXT,
  raw_json  TEXT NOT NULL,
  synced_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_state (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  access_token  TEXT NOT NULL,
  refresh_token TEXT,
  user_id       TEXT NOT NULL,
  expires_at    INTEGER NOT NULL
);
