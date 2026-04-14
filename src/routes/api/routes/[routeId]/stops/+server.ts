import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/db/connection';
import { validateFeed } from '$lib/services/validation';

/**
 * Get all stops served by a route, in sequence order from a canonical trip.
 */
export const GET: RequestHandler = async ({ params, url }) => {
	const { routeId } = params;
	const feed = validateFeed(url.searchParams.get('feed'));
	const excludeStop = url.searchParams.get('exclude') ?? '';

	if (!routeId || !feed) error(400, 'Missing params: feed');

	const db = getDb();

	// Use a canonical trip (direction 0, first match) for consistent ordering
	const stops = db
		.prepare(
			`WITH canonical_trip AS (
				SELECT trip_id FROM trips
				WHERE route_id = ? AND feed_id = ? AND direction_id = 0
				LIMIT 1
			)
			SELECT s.stop_id, s.stop_name, st.stop_sequence
			FROM stop_times st
			JOIN canonical_trip ct ON st.trip_id = ct.trip_id
			JOIN stops s ON st.stop_id = s.stop_id AND st.feed_id = s.feed_id
			WHERE st.feed_id = ?
			ORDER BY st.stop_sequence`
		)
		.all(routeId, feed, feed) as { stop_id: string; stop_name: string; stop_sequence: number }[];

	// Deduplicate by stop_id and optionally exclude the boarding stop
	const seen = new Set<string>();
	const unique = stops.filter((s) => {
		if (seen.has(s.stop_id)) return false;
		if (s.stop_id === excludeStop) return false;
		seen.add(s.stop_id);
		return true;
	});

	return json(unique);
};
