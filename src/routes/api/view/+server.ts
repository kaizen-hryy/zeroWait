import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseJsonBody } from '$lib/services/validation';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await parseJsonBody<{ activeView?: string }>(request);
	const { activeView } = body;

	if (typeof activeView !== 'string' || activeView.length > 200) {
		error(400, 'Invalid activeView');
	}
	if (activeView && !/^(group|profile):[a-f0-9-]+$/.test(activeView)) {
		error(400, 'Invalid activeView format');
	}

	cookies.set('activeView', activeView, {
		path: '/',
		maxAge: 60 * 60 * 24 * 365,
		httpOnly: true,
		sameSite: 'lax'
	});
	return json({ success: true });
};
