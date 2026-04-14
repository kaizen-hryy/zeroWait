import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNextDepartures } from '$lib/services/departures';
import { validateFeed } from '$lib/services/validation';

export const GET: RequestHandler = async ({ url }) => {
	const stopId = url.searchParams.get('stopId');
	const feedId = validateFeed(url.searchParams.get('feedId'));
	const routeId = url.searchParams.get('routeId');
	const directionId = url.searchParams.get('directionId');

	if (!stopId || !feedId || !routeId || directionId === null) {
		error(400, 'Missing required params: stopId, feedId, routeId, directionId');
	}

	const travelMin = parseInt(url.searchParams.get('travelMin') ?? '0', 10);
	const maxWaitMin = parseInt(url.searchParams.get('maxWaitMin') ?? '5', 10);
	const limit = parseInt(url.searchParams.get('limit') ?? '5', 10);
	if (isNaN(travelMin) || isNaN(maxWaitMin) || isNaN(limit)) {
		error(400, 'Numeric params must be valid integers');
	}

	const afterTime = url.searchParams.get('afterTime') ?? undefined;
	const realtime = url.searchParams.get('realtime') === '1';

	const departures = await getNextDepartures({
		stopId,
		feedId,
		routeId,
		directionId: parseInt(directionId, 10),
		travelMinutes: Math.max(0, travelMin),
		maxWaitMinutes: Math.max(1, maxWaitMin),
		limit: Math.min(20, Math.max(1, limit)),
		afterTime,
		includeRealtime: realtime
	});

	return json(departures);
};
