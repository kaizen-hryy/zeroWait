import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { importAllFeeds } from '$lib/services/gtfs-import';

let isImporting = false;

export const POST: RequestHandler = async ({ request }) => {
	// Optional secret header check
	const expectedSecret = process.env.IMPORT_SECRET;
	if (expectedSecret) {
		const secret = request.headers.get('x-import-secret');
		if (secret !== expectedSecret) {
			return json({ success: false, error: 'Unauthorized' }, { status: 401 });
		}
	}

	if (isImporting) {
		return json({ success: false, error: 'Import already in progress' }, { status: 409 });
	}

	isImporting = true;
	try {
		const results = await importAllFeeds();
		return json({ success: true, results });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		console.error('[api/gtfs/import] Import failed:', message);
		return json({ success: false, error: message }, { status: 500 });
	} finally {
		isImporting = false;
	}
};
