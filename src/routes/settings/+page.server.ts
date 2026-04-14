import type { PageServerLoad } from './$types';
import { getTimezone, isDailyBackupEnabled } from '$lib/services/settings';
import { listBackups } from '$lib/services/backup';

export const load: PageServerLoad = async () => {
	const timezones = Intl.supportedValuesOf('timeZone');
	const currentTimezone = getTimezone();
	const dailyBackupEnabled = isDailyBackupEnabled();
	const backups = listBackups();
	return { timezones, currentTimezone, dailyBackupEnabled, backups };
};
