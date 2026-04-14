import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/db/connection';
import { validateFeed } from '$lib/services/validation';

export const GET: RequestHandler = async ({ params, url }) => {
	const { routeId } = params;
	const feed = validateFeed(url.searchParams.get('feed'));

	if (!routeId) error(400, 'Missing routeId');
	if (!feed) error(400, 'Missing feed param');

	const db = getDb();

	const directions = db
		.prepare(
			`SELECT DISTINCT direction_id, trip_headsign
			 FROM trips
			 WHERE route_id = ? AND feed_id = ?
			 ORDER BY direction_id`
		)
		.all(routeId, feed) as { direction_id: number; trip_headsign: string | null }[];

	// Group by direction, pick the first non-null headsign
	const dirMap = new Map<number, string | null>();
	for (const d of directions) {
		if (!dirMap.has(d.direction_id) || (d.trip_headsign && !dirMap.get(d.direction_id))) {
			dirMap.set(d.direction_id, d.trip_headsign);
		}
	}

	const result = Array.from(dirMap.entries()).map(([directionId, headsign]) => ({
		directionId,
		headsign: headsign ?? (directionId === 0 ? 'Outbound' : 'Inbound')
	}));

	return json(result);
};
