import { getDb } from '$lib/db/connection';
import { listProfiles } from './profiles';
import { getSetting, setSetting, ALLOWED_SETTINGS } from './settings';
import { mkdirSync, writeFileSync, readdirSync, readFileSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';

const BACKUP_DIR = join(process.cwd(), 'data', 'backups');
const MAX_BACKUPS = 7;

export interface BackupData {
	version: string;
	timestamp: string;
	groups: { id: string; name: string }[];
	profiles: { id: string; name: string; groupId: string | null; steps: unknown[] }[];
	settings: Record<string, string>;
}

/** Generate a backup of all user data */
export function generateBackup(): BackupData {
	const db = getDb();
	const groups = db.prepare('SELECT id, name FROM profile_groups ORDER BY name').all() as { id: string; name: string }[];
	const profiles = listProfiles().map((p) => ({
		id: p.id,
		name: p.name,
		groupId: p.groupId,
		steps: p.steps
	}));

	const settings: Record<string, string> = {};
	for (const key of Object.keys(ALLOWED_SETTINGS)) {
		const val = getSetting(key);
		if (val !== null) settings[key] = val;
	}

	return {
		version: '1',
		timestamp: new Date().toISOString(),
		groups,
		profiles,
		settings
	};
}

/** Restore user data from a backup. Wipes existing profiles/groups, then inserts from backup. */
export function restoreBackup(data: BackupData): { profiles: number; groups: number } {
	const db = getDb();

	// Validate structure
	if (!data.version || !Array.isArray(data.profiles) || !Array.isArray(data.groups)) {
		throw new Error('Invalid backup format');
	}

	// Wipe existing user data
	db.prepare('DELETE FROM profiles').run();
	db.prepare('DELETE FROM profile_groups').run();

	// Restore groups first (profiles reference them)
	for (const group of data.groups) {
		db.prepare('INSERT INTO profile_groups (id, name) VALUES (?, ?)').run(group.id, group.name);
	}

	// Restore profiles
	for (const profile of data.profiles) {
		db.prepare('INSERT INTO profiles (id, name, group_id, data) VALUES (?, ?, ?, ?)').run(
			profile.id,
			profile.name,
			profile.groupId,
			JSON.stringify({ steps: profile.steps })
		);
	}

	// Restore settings
	if (data.settings && typeof data.settings === 'object') {
		for (const [key, value] of Object.entries(data.settings)) {
			const validator = ALLOWED_SETTINGS[key];
			if (validator && validator(value)) {
				setSetting(key, value);
			}
		}
	}

	return { profiles: data.profiles.length, groups: data.groups.length };
}

/** Save a backup file to the backups directory */
export function saveDailyBackup(): string {
	mkdirSync(BACKUP_DIR, { recursive: true });

	const backup = generateBackup();
	const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
	const filename = `backup-${date}.json`;
	const filepath = join(BACKUP_DIR, filename);

	writeFileSync(filepath, JSON.stringify(backup, null, 2));

	// Prune old backups beyond MAX_BACKUPS
	pruneOldBackups();

	return filename;
}

/** List available backup files */
export function listBackups(): { filename: string; timestamp: string; size: number }[] {
	mkdirSync(BACKUP_DIR, { recursive: true });

	try {
		const files = readdirSync(BACKUP_DIR)
			.filter((f) => f.startsWith('backup-') && f.endsWith('.json'))
			.sort()
			.reverse();

		return files.map((f) => {
			const filepath = join(BACKUP_DIR, f);
			const content = readFileSync(filepath, 'utf-8');
			let timestamp = '';
			try {
				const parsed = JSON.parse(content);
				timestamp = parsed.timestamp ?? '';
			} catch { /* ignore */ }
			const stat = statSync(filepath);
			return { filename: f, timestamp, size: stat.size };
		});
	} catch {
		return [];
	}
}

/** Restore from a named backup file */
export function restoreFromFile(filename: string): { profiles: number; groups: number } {
	// Sanitize filename to prevent directory traversal
	const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '');
	const filepath = join(BACKUP_DIR, safe);

	const content = readFileSync(filepath, 'utf-8');
	const data = JSON.parse(content) as BackupData;
	return restoreBackup(data);
}

function pruneOldBackups() {
	try {
		const files = readdirSync(BACKUP_DIR)
			.filter((f) => f.startsWith('backup-') && f.endsWith('.json'))
			.sort()
			.reverse();

		for (let i = MAX_BACKUPS; i < files.length; i++) {
			unlinkSync(join(BACKUP_DIR, files[i]));
		}
	} catch { /* ignore */ }
}
