import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/db/connection';
import { validateFeed } from '$lib/services/validation';

export const GET: RequestHandler = async ({ params, url }) => {
	const { stopId } = params;
	const feed = validateFeed(url.searchParams.get('feed'));

	if (!stopId) error(400, 'Missing stopId');

	const db = getDb();

	let query: string;
	const queryParams: string[] = [stopId];

	if (feed) {
		query = `SELECT stop_id, feed_id, stop_name, stop_lat, stop_lon, stop_code
				 FROM stops WHERE stop_id = ? AND feed_id = ?`;
		queryParams.push(feed);
	} else {
		query = `SELECT stop_id, feed_id, stop_name, stop_lat, stop_lon, stop_code
				 FROM stops WHERE stop_id = ? LIMIT 1`;
	}

	const stop = db.prepare(query).get(...queryParams);
	if (!stop) error(404, 'Stop not found');

	return json(stop);
};
