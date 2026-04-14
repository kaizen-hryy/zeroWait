import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listGroups, createGroup } from '$lib/services/profiles';
import { parseJsonBody } from '$lib/services/validation';

export const GET: RequestHandler = async () => {
	return json(listGroups());
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await parseJsonBody<{ name?: string }>(request);
	if (!body.name || typeof body.name !== 'string') error(400, 'name is required');
	const group = createGroup(body.name);
	return json(group, { status: 201 });
};
