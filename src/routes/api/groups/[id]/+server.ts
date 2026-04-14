import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGroup, updateGroup, deleteGroup } from '$lib/services/profiles';
import { parseJsonBody } from '$lib/services/validation';

export const GET: RequestHandler = async ({ params }) => {
	const group = getGroup(params.id);
	if (!group) error(404, 'Group not found');
	return json(group);
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const body = await parseJsonBody<{ name?: string }>(request);
	if (!body.name || typeof body.name !== 'string') error(400, 'name is required');
	const group = updateGroup(params.id, body.name);
	if (!group) error(404, 'Group not found');
	return json(group);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const deleted = deleteGroup(params.id);
	if (!deleted) error(404, 'Group not found');
	return json({ success: true });
};
