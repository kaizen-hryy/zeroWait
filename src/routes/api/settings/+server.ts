import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSetting, setSetting, ALLOWED_SETTINGS } from '$lib/services/settings';

export const GET: RequestHandler = async ({ url }) => {
	const key = url.searchParams.get('key');
	if (key) {
		return json({ [key]: getSetting(key) });
	}
	return json({
		default_max_wait_minutes: getSetting('default_max_wait_minutes') ?? '5',
		timezone: getSetting('timezone') ?? Intl.DateTimeFormat().resolvedOptions().timeZone
	});
};

export const PUT: RequestHandler = async ({ request }) => {
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body');
	}

	for (const [key, value] of Object.entries(body)) {
		const validator = ALLOWED_SETTINGS[key];
		if (!validator) {
			error(400, `Unknown setting: ${key}`);
		}
		const strValue = String(value);
		if (!validator(strValue)) {
			error(400, `Invalid value for ${key}`);
		}
		setSetting(key, strValue);
	}
	return json({ success: true });
};
