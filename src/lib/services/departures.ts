import type { Feed, Departure } from '$lib/types';
import { FEED_CONFIG } from '$lib/types';
import { getActiveServiceIds } from './calendar';
import { getFrequencyDepartures, timeToSeconds, secondsToTime } from './departures-frequency';
import { getScheduledDepartures } from './departures-schedule';
import { checkTripConfirmation } from './realtime';
import { estimateArrival } from './eta';
import { getDefaultMaxWaitMinutes, getTimezone } from './settings';

interface DepartureParams {
	stopId: string;
	feedId: Feed;
	routeId: string;
	directionId: number;
	travelMinutes?: number;
	maxWaitMinutes?: number | null; // null = use global default
	limit?: number;
	date?: Date;
	afterTime?: string;
	includeRealtime?: boolean;
	/** When > 0, also return scheduled departures within the last N minutes
	 *  (useful for stop-arrivals widgets that want to show the just-passed row). */
	beforeWindowMinutes?: number;
	/** Max past departures to return when beforeWindowMinutes > 0. Default 1. */
	beforeLimit?: number;
}

/**
 * Unified departure service.
 *
 * maxWait is a ceiling: leave-by = departure - travel - maxWait.
 * Actual station wait is computed dynamically based on current time.
 * Grace is implicit: if leave-by passed but vehicle hasn't departed
 * and you can still physically get there, it's shown.
 */
export async function getNextDepartures(params: DepartureParams): Promise<Departure[]> {
	const {
		stopId,
		feedId,
		routeId,
		directionId,
		travelMinutes = 0,
		maxWaitMinutes,
		limit = 5,
		date = new Date(),
		afterTime,
		includeRealtime = false,
		beforeWindowMinutes = 0,
		beforeLimit = 1
	} = params;

	const effectiveMaxWait = maxWaitMinutes ?? getDefaultMaxWaitMinutes();

	const config = FEED_CONFIG[feedId];
	const serviceIds = getActiveServiceIds(feedId, date);

	if (serviceIds.length === 0) return [];

	const currentTime = afterTime ?? getCurrentTime(date);
	const currentTimeSeconds = timeToSeconds(currentTime);
	const travelSeconds = travelMinutes * 60;
	const maxWaitSeconds = effectiveMaxWait * 60;
	const beforeWindowSeconds = Math.max(0, beforeWindowMinutes) * 60;

	// When a past window is requested, query from earlier so backends include it.
	const queryFromSeconds = currentTimeSeconds - beforeWindowSeconds;
	const queryFromTime = beforeWindowSeconds > 0 && queryFromSeconds >= 0
		? secondsToTime(queryFromSeconds)
		: currentTime;

	const fetchLimit = limit + 10;

	let departures: Departure[];

	if (config.schedulingModel === 'frequency') {
		departures = getFrequencyDepartures({
			stopId, feedId, routeId, directionId, serviceIds,
			afterTime: queryFromTime,
			limit: fetchLimit
		});
	} else {
		departures = getScheduledDepartures({
			stopId, feedId, routeId, directionId, serviceIds,
			afterTime: queryFromTime,
			limit: fetchLimit
		});
	}

	// Compute leave-by and station wait (future rows only; past rows are passthrough)
	for (const dep of departures) {
		const depSeconds = timeToSeconds(dep.departureTime);
		if (depSeconds <= currentTimeSeconds) {
			// Past row: leave leaveByTime null and stationWait null. UI treats it as "already passed".
			continue;
		}
		const leaveBySeconds = depSeconds - travelSeconds - maxWaitSeconds;
		dep.leaveByTime = leaveBySeconds >= 0 ? secondsToTime(leaveBySeconds) : null;
		dep.stationWaitMinutes = effectiveMaxWait;
	}

	// Filter departures into past-window rows and future rows
	const minSeconds = currentTimeSeconds - beforeWindowSeconds;
	const past: Departure[] = [];
	const future: Departure[] = [];
	for (const dep of departures) {
		const depSeconds = timeToSeconds(dep.departureTime);

		// Past row — keep if within the requested window (otherwise drop)
		if (depSeconds <= currentTimeSeconds) {
			if (beforeWindowSeconds > 0 && depSeconds >= minSeconds) past.push(dep);
			continue;
		}

		// If leaveByTime is null (negative), go straight to grace check
		if (!dep.leaveByTime) {
			const arriveAtStation = currentTimeSeconds + travelSeconds;
			if (arriveAtStation < depSeconds) {
				dep.stationWaitMinutes = Math.round(Math.max(0, depSeconds - arriveAtStation) / 60);
				dep.grace = true;
				future.push(dep);
			}
			continue;
		}

		const leaveBySeconds = timeToSeconds(dep.leaveByTime);

		// Leave-by still in the future — normal, compute actual wait
		if (leaveBySeconds >= currentTimeSeconds) {
			const arriveAtStation = currentTimeSeconds + travelSeconds;
			dep.stationWaitMinutes = Math.round(Math.max(0, depSeconds - arriveAtStation) / 60);
			future.push(dep);
			continue;
		}

		// Leave-by passed but can still physically reach station before departure
		const arriveAtStation = currentTimeSeconds + travelSeconds;
		if (arriveAtStation < depSeconds) {
			dep.stationWaitMinutes = Math.round(Math.max(0, depSeconds - arriveAtStation) / 60);
			dep.grace = true;
			future.push(dep);
		}
	}

	// Take the most recent past rows (closest to now first), then future rows in order.
	const pastTrimmed = beforeWindowSeconds > 0
		? past.slice(-Math.max(0, beforeLimit))
		: [];
	departures = [...pastTrimmed, ...future.slice(0, limit)];

	// Realtime confirmation + ETA
	if (includeRealtime && feedId !== 'rapid-rail-kl') {
		await Promise.all(
			departures.map(async (dep) => {
				const result = await checkTripConfirmation(dep.tripId, feedId);
				dep.confirmed = result.status === 'confirmed';
				dep.vehicleId = result.vehicleId;

				if (dep.confirmed) {
					const eta = await estimateArrival(dep.tripId, feedId, stopId);
					if (eta) {
						dep.estimatedTime = eta.estimatedTime;
						dep.delayMinutes = eta.delayMinutes;

						if (eta.delayMinutes > 0) {
							const etaSeconds = timeToSeconds(eta.estimatedTime);
							const adjustedLeaveBy = etaSeconds - travelSeconds - maxWaitSeconds;
							dep.leaveByTime = adjustedLeaveBy >= 0 ? secondsToTime(adjustedLeaveBy) : null;

							const arriveAtStation = currentTimeSeconds + travelSeconds;
							dep.stationWaitMinutes = Math.round(Math.max(0, etaSeconds - arriveAtStation) / 60);
						}
					}
				}
			})
		);
	}

	return departures;
}

function getCurrentTime(date: Date): string {
	const formatter = new Intl.DateTimeFormat('en-GB', {
		timeZone: getTimezone(),
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	});
	return formatter.format(date);
}
