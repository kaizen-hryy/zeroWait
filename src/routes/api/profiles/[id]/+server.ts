import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProfile, updateProfile, deleteProfile } from '$lib/services/profiles';
import { parseJsonBody } from '$lib/services/validation';

export const GET: RequestHandler = async ({ params }) => {
	const profile = getProfile(params.id);
	if (!profile) error(404, 'Profile not found');
	return json(profile);
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const body = await parseJsonBody<{ name?: string; groupId?: string | null; steps?: unknown[] }>(request);

	if (body.name !== undefined && typeof body.name !== 'string') error(400, 'name must be a string');
	if (body.steps !== undefined && !Array.isArray(body.steps)) error(400, 'steps must be an array');
	if (body.groupId !== undefined && body.groupId !== null && typeof body.groupId !== 'string') error(400, 'groupId must be a string or null');

	const profile = updateProfile(params.id, body as any);
	if (!profile) error(404, 'Profile not found');
	return json(profile);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const deleted = deleteProfile(params.id);
	if (!deleted) error(404, 'Profile not found');
	return json({ success: true });
};
