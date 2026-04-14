import type { PageServerLoad } from './$types';
import type { Departure, Profile, Step, TransitStep, WalkStep } from '$lib/types';
import { listGroups, getGroup, getUngroupedProfiles, listProfiles } from '$lib/services/profiles';
import { getNextDepartures } from '$lib/services/departures';
import { optimizeJourney, type OptimizedCombo } from '$lib/services/optimizer';
import { getDb } from '$lib/db/connection';
import { getTimezone } from '$lib/services/settings';

export interface StepInfo {
	type: 'walk' | 'transit';
	description?: string;
	minutes?: number;
	stopCode?: string;
	stopName?: string;
	toStopCode?: string;
	toStopName?: string;
	routeLabel?: string;
	routeColor?: string;
	headsign?: string | null;
	maxWaitMinutes?: number | null;
	rideMinutes?: number;
	departures?: Departure[];
}

export interface RouteInfo {
	profileId: string;
	profileName: string;
	steps: StepInfo[];
	routeLabel: string;
	routeColor: string;
	stopCode: string;
	stopName: string;
	departures: Departure[];
	totalWalkMinutesBefore: number;
	optimizedCombos: OptimizedCombo[];
	isMultiTransit: boolean;
	estimatedArrivalSec: number | null;
}

/** A departure from any profile in the group, for the merged list */
export interface GroupDeparture {
	departure: Departure;
	routeIndex: number; // index into rankedRoutes
	depIndex: number; // index into that route's departures
	profileName: string;
	routeLabel: string;
	routeColor: string;
}

export const load: PageServerLoad = async ({ cookies }) => {
	try {
		const feedCount = (getDb().prepare('SELECT COUNT(*) as c FROM feeds').get() as { c: number }).c;
		if (feedCount === 0) {
			return { needsImport: true, groups: [], activeView: '', activeGroupName: null, rankedRoutes: [], mergedDepartures: [] as GroupDeparture[], ungroupedProfiles: [], timezone: getTimezone(), lastRefreshed: Date.now() };
		}
	} catch {
		return { needsImport: true, groups: [], activeView: '', activeGroupName: null, rankedRoutes: [], mergedDepartures: [] as GroupDeparture[], ungroupedProfiles: [], timezone: getTimezone(), lastRefreshed: Date.now() };
	}

	const groups = listGroups();
	const ungroupedProfiles = getUngroupedProfiles();

	// Single cookie: "group:<id>" or "profile:<id>"
	let activeView = cookies.get('activeView') || '';
	let activeGroupId: string | null = null;
	let activeGroupName: string | null = null;
	let profilesToRank: Profile[] = [];

	if (activeView.startsWith('profile:')) {
		const profileId = activeView.replace('profile:', '');
		const allProfiles = listProfiles();
		const profile = allProfiles.find((p) => p.id === profileId);
		if (profile) {
			profilesToRank = [profile];
		}
	} else if (activeView.startsWith('group:')) {
		const groupId = activeView.replace('group:', '');
		const group = groups.find((g) => g.id === groupId);
		if (group) {
			activeGroupId = group.id;
			activeGroupName = group.name;
			profilesToRank = group.profiles;
		}
	}

	// Fall back: first group, then ungrouped
	if (profilesToRank.length === 0) {
		if (groups.length > 0) {
			const group = groups[0];
			activeGroupId = group.id;
			activeGroupName = group.name;
			activeView = `group:${group.id}`;
			profilesToRank = group.profiles;
			cookies.set('activeView', activeView, { path: '/', maxAge: 60 * 60 * 24 * 365, httpOnly: true, sameSite: 'lax' });
		} else if (ungroupedProfiles.length > 0) {
			profilesToRank = ungroupedProfiles;
		}
	}

	// Compute route info for each profile
	const routeInfos = await Promise.all(profilesToRank.map((p) => computeRouteInfo(p)));
	const validRoutes = routeInfos.filter((r): r is RouteInfo => r !== null);

	// Rank by fastest estimated arrival (profiles with departures first, then by arrival time)
	validRoutes.sort((a, b) => {
		if (!a.estimatedArrivalSec && !b.estimatedArrivalSec) return 0;
		if (!a.estimatedArrivalSec) return 1;
		if (!b.estimatedArrivalSec) return -1;
		return a.estimatedArrivalSec - b.estimatedArrivalSec;
	});

	// Build merged departure list from all routes in the group
	const mergedDepartures: GroupDeparture[] = [];
	for (let ri = 0; ri < validRoutes.length; ri++) {
		const route = validRoutes[ri];
		for (let di = 0; di < route.departures.length; di++) {
			mergedDepartures.push({
				departure: route.departures[di],
				routeIndex: ri,
				depIndex: di,
				profileName: route.profileName,
				routeLabel: route.routeLabel,
				routeColor: route.routeColor
			});
		}
	}
	// Sort by leave-by time
	mergedDepartures.sort((a, b) => {
		const aTime = a.departure.leaveByTime ?? '99:99:99';
		const bTime = b.departure.leaveByTime ?? '99:99:99';
		return aTime.localeCompare(bTime);
	});

	return {
		needsImport: false,
		groups,
		activeView,
		activeGroupName,
		rankedRoutes: validRoutes,
		mergedDepartures,
		ungroupedProfiles,
		timezone: getTimezone(),
		lastRefreshed: Date.now()
	};
};

async function computeStepInfo(step: Step): Promise<StepInfo> {
	if (step.type === 'walk') {
		return { type: 'walk', description: step.description, minutes: step.minutes };
	}

	const db = getDb();
	const transit = step as TransitStep;

	const route = db
		.prepare('SELECT route_short_name, route_long_name, route_color FROM routes WHERE route_id = ? AND feed_id = ?')
		.get(transit.routeId, transit.feedId) as
		| { route_short_name: string; route_long_name: string; route_color: string | null }
		| undefined;

	const fromStop = db
		.prepare('SELECT stop_id, stop_code, stop_name FROM stops WHERE stop_id = ? AND feed_id = ?')
		.get(transit.fromStopId, transit.feedId) as
		| { stop_id: string; stop_code: string | null; stop_name: string }
		| undefined;

	const toStop = transit.toStopId
		? (db.prepare('SELECT stop_id, stop_code, stop_name FROM stops WHERE stop_id = ? AND feed_id = ?')
				.get(transit.toStopId, transit.feedId) as
				| { stop_id: string; stop_code: string | null; stop_name: string }
				| undefined)
		: undefined;

	const departures = await getNextDepartures({
		stopId: transit.fromStopId,
		feedId: transit.feedId,
		routeId: transit.routeId,
		directionId: transit.directionId,
		travelMinutes: 0,
		maxWaitMinutes: transit.maxWaitMinutes,
		limit: 5,
		includeRealtime: true
	});

	let rideMinutes: number | undefined;
	if (transit.toStopId && departures.length > 0) {
		const tripId = departures[0].tripId;
		const fromSt = db.prepare('SELECT departure_time FROM stop_times WHERE trip_id = ? AND feed_id = ? AND stop_id = ?')
			.get(tripId, transit.feedId, transit.fromStopId) as { departure_time: string } | undefined;
		const toSt = db.prepare('SELECT arrival_time FROM stop_times WHERE trip_id = ? AND feed_id = ? AND stop_id = ?')
			.get(tripId, transit.feedId, transit.toStopId) as { arrival_time: string } | undefined;
		if (fromSt && toSt) {
			rideMinutes = Math.max(1, Math.round((timeToSec(toSt.arrival_time) - timeToSec(fromSt.departure_time)) / 60));
		}
	}

	return {
		type: 'transit',
		stopCode: fromStop?.stop_code || fromStop?.stop_id || transit.fromStopId,
		stopName: fromStop?.stop_name ?? '',
		toStopCode: toStop?.stop_code || toStop?.stop_id || transit.toStopId,
		toStopName: toStop?.stop_name ?? '',
		routeLabel: route?.route_short_name || route?.route_long_name || transit.routeId,
		routeColor: route?.route_color || '6c8cff',
		headsign: departures[0]?.headsign ?? null,
		maxWaitMinutes: transit.maxWaitMinutes,
		rideMinutes,
		departures
	};
}

async function computeRouteInfo(profile: Profile): Promise<RouteInfo | null> {
	const steps = profile.steps;
	if (steps.length === 0) return null;

	const stepInfos = await Promise.all(steps.map(computeStepInfo));

	const firstTransitIdx = steps.findIndex((s) => s.type === 'transit');
	if (firstTransitIdx === -1) return null;

	const firstTransit = stepInfos[firstTransitIdx];
	const transitCount = steps.filter((s) => s.type === 'transit').length;
	const isMultiTransit = transitCount > 1;

	let totalWalkMinutesBefore = 0;
	for (let i = 0; i < firstTransitIdx; i++) {
		if (steps[i].type === 'walk') totalWalkMinutesBefore += (steps[i] as WalkStep).minutes;
	}

	const transitStep = steps[firstTransitIdx] as TransitStep;
	const departuresWithWalk = await getNextDepartures({
		stopId: transitStep.fromStopId,
		feedId: transitStep.feedId,
		routeId: transitStep.routeId,
		directionId: transitStep.directionId,
		travelMinutes: totalWalkMinutesBefore,
		maxWaitMinutes: transitStep.maxWaitMinutes,
		limit: 5,
		includeRealtime: true
	});

	let optimizedCombos: OptimizedCombo[] = [];
	if (isMultiTransit) {
		optimizedCombos = await optimizeJourney(steps, 3);
	}

	// Estimate arrival for ranking: leave-by + all walk/ride/buffer durations
	let estimatedArrivalSec: number | null = null;
	if (departuresWithWalk.length > 0) {
		const dep = departuresWithWalk[0];
		let sec = timeToSec(dep.estimatedTime ?? dep.departureTime);
		// Add ride + subsequent steps
		for (let i = firstTransitIdx; i < stepInfos.length; i++) {
			const si = stepInfos[i];
			if (si.type === 'transit' && si.rideMinutes) sec += si.rideMinutes * 60;
			if (si.type === 'walk' && si.minutes) sec += si.minutes * 60;
			if (si.type === 'transit' && si.maxWaitMinutes && i > firstTransitIdx) sec += si.maxWaitMinutes * 60;
		}
		estimatedArrivalSec = sec;
	}

	return {
		profileId: profile.id,
		profileName: profile.name,
		steps: stepInfos,
		routeLabel: firstTransit.routeLabel!,
		routeColor: firstTransit.routeColor!,
		stopCode: firstTransit.stopCode!,
		stopName: firstTransit.stopName!,
		departures: departuresWithWalk,
		totalWalkMinutesBefore,
		optimizedCombos,
		isMultiTransit,
		estimatedArrivalSec
	};
}

function timeToSec(time: string): number {
	const [h, m, s] = time.split(':').map(Number);
	return h * 3600 + m * 60 + (s || 0);
}
