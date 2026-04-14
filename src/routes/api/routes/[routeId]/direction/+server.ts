import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/db/connection';
import { validateFeed } from '$lib/services/validation';

/**
 * Given a route and two stops (from, to), determine the direction_id.
 * Works by checking which direction has fromStop sequenced before toStop.
 */
export const GET: RequestHandler = async ({ params, url }) => {
	const { routeId } = params;
	const feed = validateFeed(url.searchParams.get('feed'));
	const fromStop = url.searchParams.get('from');
	const toStop = url.searchParams.get('to');

	if (!routeId || !feed || !fromStop || !toStop) {
		error(400, 'Missing params: feed, from, to');
	}

	const db = getDb();

	// For each direction, check the stop_sequence of both stops
	const directions = db
		.prepare(
			`SELECT DISTINCT t.direction_id
			 FROM trips t
			 WHERE t.route_id = ? AND t.feed_id = ?`
		)
		.all(routeId, feed) as { direction_id: number }[];

	for (const { direction_id } of directions) {
		// Get a trip for this direction
		const trip = db
			.prepare(
				`SELECT trip_id FROM trips
				 WHERE route_id = ? AND feed_id = ? AND direction_id = ?
				 LIMIT 1`
			)
			.get(routeId, feed, direction_id) as { trip_id: string } | undefined;

		if (!trip) continue;

		// Get stop sequences for both stops in this trip
		const fromSeq = db
			.prepare(
				`SELECT stop_sequence FROM stop_times
				 WHERE trip_id = ? AND feed_id = ? AND stop_id = ?`
			)
			.get(trip.trip_id, feed, fromStop) as { stop_sequence: number } | undefined;

		const toSeq = db
			.prepare(
				`SELECT stop_sequence FROM stop_times
				 WHERE trip_id = ? AND feed_id = ? AND stop_id = ?`
			)
			.get(trip.trip_id, feed, toStop) as { stop_sequence: number } | undefined;

		if (fromSeq && toSeq && fromSeq.stop_sequence < toSeq.stop_sequence) {
			return json({ directionId: direction_id, auto: true });
		}
	}

	// Couldn't auto-detect — return null so UI can fall back to manual selection
	return json({ directionId: null, auto: false });
};
