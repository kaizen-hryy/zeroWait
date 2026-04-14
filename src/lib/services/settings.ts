import { getDb } from '$lib/db/connection';

export function getSetting(key: string): string | null {
	const row = getDb()
		.prepare('SELECT value FROM settings WHERE key = ?')
		.get(key) as { value: string } | undefined;
	return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
	getDb()
		.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
		.run(key, value);
}

export function getDefaultMaxWaitMinutes(): number {
	const val = getSetting('default_max_wait_minutes');
	return val ? parseInt(val, 10) : 5;
}

/** Get configured timezone, falling back to server's local timezone */
export function getTimezone(): string {
	return getSetting('timezone') ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Valid setting keys and their validators */
export const ALLOWED_SETTINGS: Record<string, (v: string) => boolean> = {
	default_max_wait_minutes: (v) => /^\d+$/.test(v) && +v >= 1 && +v <= 60,
	timezone: (v) => {
		try {
			Intl.DateTimeFormat(undefined, { timeZone: v });
			return true;
		} catch { return false; }
	}
};
