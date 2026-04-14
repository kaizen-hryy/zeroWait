import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listBackups, restoreFromFile, saveDailyBackup } from '$lib/services/backup';

/** GET: List available auto-backup files */
export const GET: RequestHandler = async () => {
	return json(listBackups());
};

/** POST: Restore from an auto-backup file or trigger a manual backup */
export const POST: RequestHandler = async ({ request }) => {
	let body: { action: string; filename?: string };
	try {
		body = await request.json();
	} catch {
		return json({ success: false, error: 'Invalid JSON' }, { status: 400 });
	}

	if (body.action === 'backup-now') {
		const filename = saveDailyBackup();
		return json({ success: true, filename });
	}

	if (body.action === 'restore' && body.filename) {
		try {
			const result = restoreFromFile(body.filename);
			return json({ success: true, ...result });
		} catch (e) {
			return json({ success: false, error: String(e) }, { status: 400 });
		}
	}

	return json({ success: false, error: 'Invalid action' }, { status: 400 });
};
