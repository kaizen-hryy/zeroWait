import type { Feed, Departure } from '$lib/types';
import { getDb } from '$lib/db/connection';

interface ScheduleDepartureParams {
	stopId: string;
	feedId: Feed;
	routeId: string;
	directionId: number;
	serviceIds: string[];
	afterTime: string; // HH:MM:SS
	limit: number;
}

/**
 * Get departures for schedule-based feeds (mrtfeeder, ktmb).
 * Direct SQL query against stop_times joined with trips.
 */
export function getScheduledDepartures(params: ScheduleDepartureParams): Departure[] {
	const { stopId, feedId, routeId, directionId, serviceIds, afterTime, limit } = params;
	if (serviceIds.length === 0) return [];

	const db = getDb();
	const placeholders = serviceIds.map(() => '?').join(',');

	const rows = db
		.prepare(
			`SELECT st.departure_time, st.trip_id, t.trip_headsign
			 FROM stop_times st
			 JOIN trips t ON st.trip_id = t.trip_id AND st.feed_id = t.feed_id
			 WHERE st.stop_id = ? AND st.feed_id = ?
			 AND t.route_id = ? AND t.direction_id = ?
			 AND t.service_id IN (${placeholders})
			 AND st.departure_time > ?
			 ORDER BY st.departure_time
			 LIMIT ?`
		)
		.all(stopId, feedId, routeId, directionId, ...serviceIds, afterTime, limit) as {
		departure_time: string;
		trip_id: string;
		trip_headsign: string | null;
	}[];

	return rows.map((row) => ({
		departureTime: row.departure_time,
		leaveByTime: null, // computed by caller
		tripId: row.trip_id,
		routeId,
		feedId,
		headsign: row.trip_headsign,
		confirmed: null,
		vehicleId: null,
		estimatedTime: null,
		delayMinutes: null,
		grace: false,
		stationWaitMinutes: null
	}));
}
