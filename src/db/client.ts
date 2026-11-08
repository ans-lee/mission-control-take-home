import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const DB_PATH =
  process.env.MC_DB ?? join(__dirname, '..', '..', 'mission-control.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/** Drop + recreate all tables from schema.sql. Used by seed and tests. */
export function resetDb(): Database.Database {
  const database = getDb();
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  database.exec(schema);
  // Clear in FK-safe order in case schema uses IF NOT EXISTS on existing data.
  database.exec(`
    DELETE FROM availability_blocks;
    DELETE FROM assignments;
    DELETE FROM mission_requirements;
    DELETE FROM missions;
    DELETE FROM crew_skills;
    DELETE FROM skills;
    DELETE FROM users;
    DELETE FROM organisations;
  `);
  return database;
}

export function closeDb(): void {
  db?.close();
  db = null;
}
