import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listProfiles, createProfile } from '$lib/services/profiles';
import { parseJsonBody } from '$lib/services/validation';

export const GET: RequestHandler = async () => {
	return json(listProfiles());
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await parseJsonBody<{ name?: string; groupId?: string | null; steps?: unknown[] }>(request);

	if (!body.name || typeof body.name !== 'string') error(400, 'name is required and must be a string');
	if (!Array.isArray(body.steps)) error(400, 'steps must be an array');

	const profile = createProfile({
		name: body.name,
		groupId: body.groupId ?? null,
		steps: body.steps as any
	});

	return json(profile, { status: 201 });
};
