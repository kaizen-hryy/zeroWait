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

export function getStopWidgetArrivalCount(): number {
	const val = getSetting('stop_widget_arrival_count');
	return val ? parseInt(val, 10) : 4;
}

/** Get configured timezone, falling back to server's local timezone */
export function getTimezone(): string {
	return getSetting('timezone') ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Valid setting keys and their validators */
export const ALLOWED_SETTINGS: Record<string, (v: string) => boolean> = {
	default_max_wait_minutes: (v) => /^\d+$/.test(v) && +v >= 1 && +v <= 60,
	stop_widget_arrival_count: (v) => /^\d+$/.test(v) && +v >= 2 && +v <= 8,
	timezone: (v) => {
		try {
			Intl.DateTimeFormat(undefined, { timeZone: v });
			return true;
		} catch { return false; }
	},
	daily_backup_enabled: (v) => v === 'true' || v === 'false'
};

export function isDailyBackupEnabled(): boolean {
	return getSetting('daily_backup_enabled') === 'true';
}
