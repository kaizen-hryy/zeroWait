import type { ActiveTrip } from '$lib/types';

const STORAGE_KEY = 'zerowait_active_trip';

export function getActiveTrip(): ActiveTrip | null {
	if (typeof localStorage === 'undefined') return null;
	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as ActiveTrip;
	} catch {
		return null;
	}
}

export function setActiveTrip(trip: ActiveTrip): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(trip));
}

export function clearActiveTrip(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.removeItem(STORAGE_KEY);
}
