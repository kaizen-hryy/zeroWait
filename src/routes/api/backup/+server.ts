import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateBackup, restoreBackup } from '$lib/services/backup';

/** GET: Generate and return a backup as JSON */
export const GET: RequestHandler = async () => {
	const backup = generateBackup();
	return json(backup);
};

/** POST: Restore from uploaded backup JSON */
export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body');
	}

	try {
		const result = restoreBackup(body as any);
		return json({ success: true, ...result });
	} catch (e) {
		error(400, String(e));
	}
};
