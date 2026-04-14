import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/db/connection';
import { validateFeed } from '$lib/services/validation';

export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q') ?? '';
	const feed = validateFeed(url.searchParams.get('feed'));
	const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10) || 20));

	const db = getDb();

	let query: string;
	const params: (string | number)[] = [];

	if (feed) {
		query = `SELECT stop_id, feed_id, stop_name, stop_lat, stop_lon, stop_code
				 FROM stops WHERE feed_id = ? AND stop_name LIKE ? ORDER BY stop_name LIMIT ?`;
		params.push(feed, `%${q}%`, limit);
	} else {
		query = `SELECT stop_id, feed_id, stop_name, stop_lat, stop_lon, stop_code
				 FROM stops WHERE stop_name LIKE ? ORDER BY stop_name LIMIT ?`;
		params.push(`%${q}%`, limit);
	}

	const stops = db.prepare(query).all(...params);
	return json(stops);
};
