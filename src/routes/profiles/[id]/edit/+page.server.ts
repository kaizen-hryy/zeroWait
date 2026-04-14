import type { PageServerLoad } from './$types';
import { getProfile, listGroups } from '$lib/services/profiles';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const profile = getProfile(params.id);
	if (!profile) error(404, 'Profile not found');
	const groups = listGroups();
	return { profile, groups };
};
