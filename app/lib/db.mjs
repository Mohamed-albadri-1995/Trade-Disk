// Trade-Disk — the data layer (solo mode).
// One thin wrapper over node:sqlite so the API never touches a driver directly;
// the same call shape (openDb / query helpers) is what the Postgres adapter will
// implement for hosted mode, so routes do not change when the store does.

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const DB_PATH = join(import.meta.dirname, '..', 'data', 'journal.db');
const SCHEMA = join(import.meta.dirname, '..', 'db', 'schema.sql');

export function openDb(file = DB_PATH) {
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(readFileSync(SCHEMA, 'utf8')); // idempotent (IF NOT EXISTS)
  return db;
}

export const all = (db, sql, ...p) => db.prepare(sql).all(...p);
export const one = (db, sql, ...p) => db.prepare(sql).get(...p);
export const run = (db, sql, ...p) => db.prepare(sql).run(...p);
