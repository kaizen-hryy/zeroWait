import type { PageServerLoad } from './$types';
import { getTimezone } from '$lib/services/settings';

export const load: PageServerLoad = async () => {
	const timezones = Intl.supportedValuesOf('timeZone');
	const currentTimezone = getTimezone();
	return { timezones, currentTimezone };
};
