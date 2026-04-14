import type { Feed } from '$lib/types';
import { getDb } from '$lib/db/connection';
import { getTimezone } from './settings';

const DAY_COLUMNS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Get active service IDs for a given feed and date.
 * Checks calendar.txt day-of-week + date range, then applies calendar_dates exceptions.
 */
export function getActiveServiceIds(feed: Feed, date: Date): string[] {
	const db = getDb();
	const tz = getTimezone();
	const dayOfWeek = getDayOfWeek(date, tz);
	const dayColumn = DAY_COLUMNS[dayOfWeek];
	const dateStr = formatDate(date, tz);

	// Find services running on this day of week within the date range
	const baseServices = db
		.prepare(
			`SELECT service_id FROM calendar
			 WHERE feed_id = ? AND ${dayColumn} = 1
			 AND start_date <= ? AND end_date >= ?`
		)
		.all(feed, dateStr, dateStr) as { service_id: string }[];

	const serviceSet = new Set(baseServices.map((r) => r.service_id));

	// Apply calendar_dates exceptions
	const exceptions = db
		.prepare(
			`SELECT service_id, exception_type FROM calendar_dates
			 WHERE feed_id = ? AND date = ?`
		)
		.all(feed, dateStr) as { service_id: string; exception_type: number }[];

	for (const exc of exceptions) {
		if (exc.exception_type === 1) {
			serviceSet.add(exc.service_id); // Service added for this date
		} else if (exc.exception_type === 2) {
			serviceSet.delete(exc.service_id); // Service removed for this date
		}
	}

	return Array.from(serviceSet);
}

/** Get day of week (0=Sunday) in the configured timezone */
function getDayOfWeek(date: Date, tz: string): number {
	const weekday = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(date);
	const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
	return map[weekday] ?? 0;
}

/** Format date as YYYYMMDD in the configured timezone */
function formatDate(date: Date, tz: string): string {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: tz,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(date);
	return parts.replace(/-/g, '');
}
