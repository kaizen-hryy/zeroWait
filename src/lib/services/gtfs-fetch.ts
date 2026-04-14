import type { Feed } from '$lib/types';

const BASE_URL = 'https://api.data.gov.my';

const FEED_ENDPOINTS: Record<Feed, string> = {
	'rapid-rail-kl': '/gtfs-static/prasarana?category=rapid-rail-kl',
	'rapid-bus-kl': '/gtfs-static/prasarana?category=rapid-bus-kl',
	'rapid-bus-mrtfeeder': '/gtfs-static/prasarana?category=rapid-bus-mrtfeeder',
	ktmb: '/gtfs-static/ktmb'
};

export async function fetchGtfsZip(feed: Feed): Promise<Buffer> {
	const url = `${BASE_URL}${FEED_ENDPOINTS[feed]}`;
	const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(60_000) });

	if (!response.ok) {
		throw new Error(`Failed to fetch GTFS for ${feed}: ${response.status} ${response.statusText}`);
	}

	const arrayBuffer = await response.arrayBuffer();
	return Buffer.from(arrayBuffer);
}
