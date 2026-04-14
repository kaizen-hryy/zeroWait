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
		query = `SELECT DISTINCT r.route_id, r.feed_id, r.route_short_name, r.route_long_name,
				 r.route_type, r.route_color, r.route_text_color
				 FROM stop_times st
				 JOIN trips t ON st.trip_id = t.trip_id AND st.feed_id = t.feed_id
				 JOIN routes r ON t.route_id = r.route_id AND t.feed_id = r.feed_id
				 WHERE st.stop_id = ? AND st.feed_id = ?`;
		queryParams.push(feed);
	} else {
		query = `SELECT DISTINCT r.route_id, r.feed_id, r.route_short_name, r.route_long_name,
				 r.route_type, r.route_color, r.route_text_color
				 FROM stop_times st
				 JOIN trips t ON st.trip_id = t.trip_id AND st.feed_id = t.feed_id
				 JOIN routes r ON t.route_id = r.route_id AND t.feed_id = r.feed_id
				 WHERE st.stop_id = ?`;
	}

	const routes = db.prepare(query).all(...queryParams);
	return json(routes);
};
