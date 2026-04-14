import type { PageServerLoad } from './$types';
import { listGroups } from '$lib/services/profiles';

export const load: PageServerLoad = async () => {
	return { groups: listGroups() };
};
