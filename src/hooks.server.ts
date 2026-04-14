import type { Handle } from '@sveltejs/kit';
import { getDb } from '$lib/db/connection';
import { importAllFeeds, getLastImportTime } from '$lib/services/gtfs-import';

let schedulerStarted = false;

function startDailyScheduler() {
	if (schedulerStarted) return;
	schedulerStarted = true;

	function scheduleNextImport() {
		const now = new Date();
		// Target 4:00 AM MYT (UTC+8)
		const myt = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
		const target = new Date(myt);
		target.setHours(4, 0, 0, 0);

		// If 4am already passed today, schedule for tomorrow
		if (myt >= target) {
			target.setDate(target.getDate() + 1);
		}

		const msUntilTarget = target.getTime() - myt.getTime();
		console.log(`[scheduler] Next GTFS import scheduled in ${Math.round(msUntilTarget / 60000)} minutes`);

		setTimeout(async () => {
			console.log('[scheduler] Running daily GTFS import...');
			try {
				await importAllFeeds();
				console.log('[scheduler] Daily import complete');
			} catch (err) {
				console.error('[scheduler] Daily import failed:', err);
			}
			// Schedule the next one
			scheduleNextImport();
		}, msUntilTarget);
	}

	scheduleNextImport();
}

export const handle: Handle = async ({ event, resolve }) => {
	// Ensure DB is initialized on first request
	getDb();

	// Start the daily scheduler
	startDailyScheduler();

	return resolve(event);
};
