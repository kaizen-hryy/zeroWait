import type { Feed } from '$lib/types';
import { FEED_CONFIG } from '$lib/types';
import { getDb } from '$lib/db/connection';
import { fetchGtfsZip } from './gtfs-fetch';
import { parseGtfsZip } from './gtfs-parse';
import { normalizeGtfsData, type NormalizedGtfsData } from './gtfs-normalize';

const ALL_FEEDS: Feed[] = ['rapid-rail-kl', 'rapid-bus-kl', 'rapid-bus-mrtfeeder', 'ktmb'];

export async function importFeed(feed: Feed): Promise<{ rowCounts: Record<string, number> }> {
	console.log(`[gtfs-import] Fetching ${feed}...`);
	const zipBuffer = await fetchGtfsZip(feed);

	console.log(`[gtfs-import] Parsing ${feed}...`);
	const files = await parseGtfsZip(zipBuffer);

	console.log(`[gtfs-import] Normalizing ${feed}...`);
	const data = normalizeGtfsData(feed, files);

	console.log(`[gtfs-import] Inserting ${feed} into DB...`);
	const rowCounts = insertIntoDb(feed, data);

	console.log(`[gtfs-import] Done: ${feed}`, rowCounts);
	return { rowCounts };
}

export async function importAllFeeds(): Promise<Record<Feed, Record<string, number>>> {
	const results: Partial<Record<Feed, Record<string, number>>> = {};

	for (const feed of ALL_FEEDS) {
		try {
			const { rowCounts } = await importFeed(feed);
			results[feed] = rowCounts;
		} catch (err) {
			console.error(`[gtfs-import] Failed to import ${feed}:`, err);
			results[feed] = { error: 1 };
		}
	}

	return results as Record<Feed, Record<string, number>>;
}

function insertIntoDb(feed: Feed, data: NormalizedGtfsData): Record<string, number> {
	const db = getDb();
	const config = FEED_CONFIG[feed];

	const rowCounts: Record<string, number> = {};

	db.transaction(() => {
		// Clear existing data for this feed
		db.prepare('DELETE FROM shapes WHERE feed_id = ?').run(feed);
		db.prepare('DELETE FROM frequencies WHERE feed_id = ?').run(feed);
		db.prepare('DELETE FROM calendar_dates WHERE feed_id = ?').run(feed);
		db.prepare('DELETE FROM calendar WHERE feed_id = ?').run(feed);
		db.prepare('DELETE FROM stop_times WHERE feed_id = ?').run(feed);
		db.prepare('DELETE FROM trips WHERE feed_id = ?').run(feed);
		db.prepare('DELETE FROM routes WHERE feed_id = ?').run(feed);
		db.prepare('DELETE FROM stops WHERE feed_id = ?').run(feed);

		// Update feed metadata
		db.prepare(
			`INSERT OR REPLACE INTO feeds (feed_id, scheduling_model, last_updated)
			 VALUES (?, ?, ?)`
		).run(feed, config.schedulingModel, new Date().toISOString());

		// Insert stops
		const insertStop = db.prepare(
			`INSERT INTO stops (stop_id, feed_id, stop_name, stop_lat, stop_lon, stop_code)
			 VALUES (?, ?, ?, ?, ?, ?)`
		);
		for (const s of data.stops) {
			insertStop.run(s.stop_id, s.feed_id, s.stop_name, s.stop_lat, s.stop_lon, s.stop_code);
		}
		rowCounts.stops = data.stops.length;

		// Insert routes
		const insertRoute = db.prepare(
			`INSERT INTO routes (route_id, feed_id, agency_id, route_short_name, route_long_name, route_type, route_color, route_text_color)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		);
		for (const r of data.routes) {
			insertRoute.run(
				r.route_id, r.feed_id, r.agency_id, r.route_short_name,
				r.route_long_name, r.route_type, r.route_color, r.route_text_color
			);
		}
		rowCounts.routes = data.routes.length;

		// Insert trips
		const insertTrip = db.prepare(
			`INSERT INTO trips (trip_id, feed_id, route_id, service_id, direction_id, trip_headsign, shape_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		);
		for (const t of data.trips) {
			insertTrip.run(t.trip_id, t.feed_id, t.route_id, t.service_id, t.direction_id, t.trip_headsign, t.shape_id);
		}
		rowCounts.trips = data.trips.length;

		// Insert stop_times
		const insertStopTime = db.prepare(
			`INSERT INTO stop_times (trip_id, feed_id, stop_id, stop_sequence, arrival_time, departure_time, shape_dist_traveled)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		);
		for (const st of data.stopTimes) {
			insertStopTime.run(
				st.trip_id, st.feed_id, st.stop_id, st.stop_sequence,
				st.arrival_time, st.departure_time, st.shape_dist_traveled
			);
		}
		rowCounts.stop_times = data.stopTimes.length;

		// Insert calendar
		const insertCalendar = db.prepare(
			`INSERT INTO calendar (service_id, feed_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		);
		for (const c of data.calendar) {
			insertCalendar.run(
				c.service_id, c.feed_id, c.monday, c.tuesday, c.wednesday,
				c.thursday, c.friday, c.saturday, c.sunday, c.start_date, c.end_date
			);
		}
		rowCounts.calendar = data.calendar.length;

		// Insert calendar_dates
		const insertCalendarDate = db.prepare(
			`INSERT INTO calendar_dates (service_id, feed_id, date, exception_type)
			 VALUES (?, ?, ?, ?)`
		);
		for (const cd of data.calendarDates) {
			insertCalendarDate.run(cd.service_id, cd.feed_id, cd.date, cd.exception_type);
		}
		rowCounts.calendar_dates = data.calendarDates.length;

		// Insert frequencies
		const insertFrequency = db.prepare(
			`INSERT INTO frequencies (trip_id, feed_id, start_time, end_time, headway_secs)
			 VALUES (?, ?, ?, ?, ?)`
		);
		for (const f of data.frequencies) {
			insertFrequency.run(f.trip_id, f.feed_id, f.start_time, f.end_time, f.headway_secs);
		}
		rowCounts.frequencies = data.frequencies.length;

		// Insert shapes
		const insertShape = db.prepare(
			`INSERT INTO shapes (shape_id, feed_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence, shape_dist_traveled)
			 VALUES (?, ?, ?, ?, ?, ?)`
		);
		for (const s of data.shapes) {
			insertShape.run(s.shape_id, s.feed_id, s.shape_pt_lat, s.shape_pt_lon, s.shape_pt_sequence, s.shape_dist_traveled);
		}
		rowCounts.shapes = data.shapes.length;
	})();

	return rowCounts;
}

export function getLastImportTime(feed: Feed): string | null {
	const db = getDb();
	const row = db.prepare('SELECT last_updated FROM feeds WHERE feed_id = ?').get(feed) as
		| { last_updated: string }
		| undefined;
	return row?.last_updated ?? null;
}
