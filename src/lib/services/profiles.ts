import type { Profile, ProfileGroup, Step, Leg } from '$lib/types';
import { getDb } from '$lib/db/connection';
import { randomUUID } from 'crypto';

// === Profiles ===

export function listProfiles(): Profile[] {
	const db = getDb();
	const rows = db.prepare('SELECT id, name, group_id, data FROM profiles ORDER BY name').all() as {
		id: string;
		name: string;
		group_id: string | null;
		data: string;
	}[];

	return rows.map(deserializeProfile);
}

export function getProfile(id: string): Profile | null {
	const db = getDb();
	const row = db.prepare('SELECT id, name, group_id, data FROM profiles WHERE id = ?').get(id) as
		| { id: string; name: string; group_id: string | null; data: string }
		| undefined;

	return row ? deserializeProfile(row) : null;
}

export function createProfile(input: { name: string; groupId?: string | null; steps: Step[] }): Profile {
	const db = getDb();
	const id = randomUUID();
	const data = JSON.stringify({ steps: input.steps });

	db.prepare('INSERT INTO profiles (id, name, group_id, data) VALUES (?, ?, ?, ?)').run(
		id, input.name, input.groupId ?? null, data
	);

	return { id, name: input.name, groupId: input.groupId ?? null, steps: input.steps };
}

export function updateProfile(
	id: string,
	updates: { name?: string; groupId?: string | null; steps?: Step[] }
): Profile | null {
	const existing = getProfile(id);
	if (!existing) return null;

	const name = updates.name ?? existing.name;
	const groupId = updates.groupId !== undefined ? updates.groupId : existing.groupId;
	const steps = updates.steps ?? existing.steps;
	const data = JSON.stringify({ steps });

	getDb().prepare('UPDATE profiles SET name = ?, group_id = ?, data = ? WHERE id = ?').run(name, groupId, data, id);

	return { id, name, groupId, steps };
}

export function deleteProfile(id: string): boolean {
	const result = getDb().prepare('DELETE FROM profiles WHERE id = ?').run(id);
	return result.changes > 0;
}

// === Groups ===

export function listGroups(): ProfileGroup[] {
	const db = getDb();
	const groups = db.prepare('SELECT id, name FROM profile_groups ORDER BY name').all() as {
		id: string;
		name: string;
	}[];

	const allProfiles = listProfiles();

	return groups.map((g) => ({
		...g,
		profiles: allProfiles.filter((p) => p.groupId === g.id)
	}));
}

export function getGroup(id: string): ProfileGroup | null {
	const db = getDb();
	const row = db.prepare('SELECT id, name FROM profile_groups WHERE id = ?').get(id) as
		| { id: string; name: string }
		| undefined;

	if (!row) return null;

	const profiles = listProfiles().filter((p) => p.groupId === id);
	return { ...row, profiles };
}

export function createGroup(name: string): ProfileGroup {
	const db = getDb();
	const id = randomUUID();
	db.prepare('INSERT INTO profile_groups (id, name) VALUES (?, ?)').run(id, name);
	return { id, name, profiles: [] };
}

export function updateGroup(id: string, name: string): ProfileGroup | null {
	const db = getDb();
	const result = db.prepare('UPDATE profile_groups SET name = ? WHERE id = ?').run(name, id);
	if (result.changes === 0) return null;
	return getGroup(id);
}

export function deleteGroup(id: string): boolean {
	const db = getDb();
	// Ungroup profiles in this group
	db.prepare('UPDATE profiles SET group_id = NULL WHERE group_id = ?').run(id);
	const result = db.prepare('DELETE FROM profile_groups WHERE id = ?').run(id);
	return result.changes > 0;
}

// === Ungrouped profiles ===

export function getUngroupedProfiles(): Profile[] {
	return listProfiles().filter((p) => !p.groupId);
}

// === Migration helper ===

/** Migrate old format: extract fallbacks into separate profiles in a new group */
function migrateLegsToSteps(legs: Leg[]): Step[] {
	const steps: Step[] = [];
	for (const leg of legs) {
		if (leg.travelMinutes > 0) {
			steps.push({ type: 'walk', description: 'Walk to stop', minutes: leg.travelMinutes });
		}
		steps.push({
			type: 'transit',
			feedId: leg.feedId,
			routeId: leg.routeId,
			fromStopId: leg.stopId,
			toStopId: '',
			directionId: leg.directionId,
			maxWaitMinutes: leg.bufferMinutes
		});
	}
	return steps;
}

function deserializeProfile(row: { id: string; name: string; group_id: string | null; data: string }): Profile {
	let parsed: any;
	try {
		parsed = JSON.parse(row.data);
	} catch {
		console.error(`[profiles] Corrupt data for profile ${row.id}, resetting to empty`);
		return { id: row.id, name: row.name, groupId: row.group_id, steps: [] };
	}

	let steps: Step[];
	if (parsed.steps) {
		steps = parsed.steps;
		// Migrate bufferMinutes → maxWaitMinutes in existing transit steps
		for (const step of steps) {
			if (step.type === 'transit' && 'bufferMinutes' in step && !('maxWaitMinutes' in step)) {
				(step as any).maxWaitMinutes = (step as any).bufferMinutes;
				delete (step as any).bufferMinutes;
			}
		}
	} else if (parsed.legs) {
		steps = migrateLegsToSteps(parsed.legs);
	} else {
		steps = [];
	}

	// If old format has fallbacks, migrate them into separate profiles in a group
	if (parsed.fallbacks && parsed.fallbacks.length > 0) {
		try {
			migrateFallbacksToGroup(row.id, row.name, parsed.fallbacks);
			// Clear fallbacks from this profile's data
			const db = getDb();
			db.prepare('UPDATE profiles SET data = ? WHERE id = ?').run(
				JSON.stringify({ steps }),
				row.id
			);
		} catch (err) {
			console.error(`[profiles] Failed to migrate fallbacks for profile ${row.id}:`, err);
		}
	}

	return { id: row.id, name: row.name, groupId: row.group_id, steps };
}

function migrateFallbacksToGroup(profileId: string, profileName: string, fallbacks: any[]): void {
	const db = getDb();

	// Check if already migrated (profile already has a group)
	const existing = db.prepare('SELECT group_id FROM profiles WHERE id = ?').get(profileId) as { group_id: string | null } | undefined;
	if (existing?.group_id) return;

	// Create a group
	const groupId = randomUUID();
	const groupName = profileName;
	db.prepare('INSERT OR IGNORE INTO profile_groups (id, name) VALUES (?, ?)').run(groupId, groupName);

	// Assign this profile to the group
	db.prepare('UPDATE profiles SET group_id = ? WHERE id = ?').run(groupId, profileId);

	// Create profiles from fallbacks
	for (let i = 0; i < fallbacks.length; i++) {
		const fbSteps: Step[] = Array.isArray(fallbacks[i])
			? (fallbacks[i][0]?.type ? fallbacks[i] : migrateLegsToSteps(fallbacks[i]))
			: [];
		if (fbSteps.length === 0) continue;

		const fbId = randomUUID();
		const fbName = `${profileName} (Alt ${i + 1})`;
		const fbData = JSON.stringify({ steps: fbSteps });
		db.prepare('INSERT OR IGNORE INTO profiles (id, name, group_id, data) VALUES (?, ?, ?, ?)').run(
			fbId, fbName, groupId, fbData
		);
	}
}
