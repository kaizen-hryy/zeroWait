import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { mkdirSync } from 'fs';

const SCHEMA_PATH = join(process.cwd(), 'src', 'lib', 'db', 'schema.sql');
const DB_DIR = join(process.cwd(), 'data');
const DB_PATH = join(DB_DIR, 'zerowait.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
	if (db) return db;

	mkdirSync(DB_DIR, { recursive: true });

	db = new Database(DB_PATH);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');

	const schema = readFileSync(SCHEMA_PATH, 'utf-8');
	db.exec(schema);

	// Migrations for existing DBs
	runMigrations(db);

	return db;
}

function runMigrations(db: Database.Database): void {
	// Add group_id to profiles if missing
	const profileCols = db.prepare('PRAGMA table_info(profiles)').all() as { name: string }[];
	if (!profileCols.find((c) => c.name === 'group_id')) {
		db.exec('ALTER TABLE profiles ADD COLUMN group_id TEXT');
	}

	// Add shape_id to trips if missing
	const tripCols = db.prepare('PRAGMA table_info(trips)').all() as { name: string }[];
	if (!tripCols.find((c) => c.name === 'shape_id')) {
		db.exec('ALTER TABLE trips ADD COLUMN shape_id TEXT');
	}

	// Add shape_dist_traveled to stop_times if missing
	const stCols = db.prepare('PRAGMA table_info(stop_times)').all() as { name: string }[];
	if (!stCols.find((c) => c.name === 'shape_dist_traveled')) {
		db.exec('ALTER TABLE stop_times ADD COLUMN shape_dist_traveled REAL');
	}
}
