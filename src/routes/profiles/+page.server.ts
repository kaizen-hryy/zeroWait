import type { PageServerLoad } from './$types';
import { listProfiles, listGroups } from '$lib/services/profiles';

export const load: PageServerLoad = async () => {
	return { profiles: listProfiles(), groups: listGroups() };
};
