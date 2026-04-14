import { FEED_CONFIG, type Feed } from '$lib/types';
import { error } from '@sveltejs/kit';

const VALID_FEEDS = new Set(Object.keys(FEED_CONFIG));

export function isValidFeed(value: string | null): value is Feed {
	return value !== null && VALID_FEEDS.has(value);
}

/** Validate feedId param, return 400 if invalid (when provided) */
export function validateFeed(feedId: string | null): Feed | null {
	if (!feedId) return null;
	if (!isValidFeed(feedId)) error(400, 'Invalid feed');
	return feedId;
}

/** Parse JSON body safely, return 400 on malformed input */
export async function parseJsonBody<T = unknown>(request: Request): Promise<T> {
	try {
		return await request.json();
	} catch {
		error(400, 'Invalid JSON body');
	}
}
