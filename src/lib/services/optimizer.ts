import type { Step, TransitStep, WalkStep, Departure, Feed } from '$lib/types';
import { getNextDepartures } from './departures';
import { getDb } from '$lib/db/connection';
import { getDefaultMaxWaitMinutes } from './settings';

export interface OptimizedCombo {
	/** One departure per transit step, in order */
	departures: (Departure & { stepIndex: number })[];
	/** Leave-by time accounting for all pre-first-transit walks */
	leaveByTime: string;
	/** Total wait time at transfer points (minutes) */
	totalWaitMinutes: number;
	/** Estimated arrival time at final destination */
	estimatedArrival: string;
	/** Per-step timeline with estimated times */
	timeline: TimelineEntry[];
}

export interface TimelineEntry {
	time: string; // HH:MM AM/PM
	timeSec: number;
	label: string;
	stepIndex: number;
	type: 'leave' | 'walk' | 'board' | 'alight' | 'arrive';
}

/**
 * Find the best departure combinations across all transit steps in a journey,
 * minimizing total wait time at transfers.
 *
 * @param steps - The journey steps (walk + transit)
 * @param limit - Number of top combos to return (default 3)
 */
export async function optimizeJourney(
	steps: Step[],
	limit: number = 3
): Promise<OptimizedCombo[]> {
	const transitSteps: { step: TransitStep; index: number }[] = [];
	for (let i = 0; i < steps.length; i++) {
		if (steps[i].type === 'transit') {
			transitSteps.push({ step: steps[i] as TransitStep, index: i });
		}
	}

	if (transitSteps.length === 0) return [];

	const defaultMaxWait = getDefaultMaxWaitMinutes();
	const getMaxWait = (step: TransitStep) => step.maxWaitMinutes ?? defaultMaxWait;

	// Get ride durations for each transit step
	const rideDurations = await Promise.all(
		transitSteps.map(({ step }) => getRideDurationMinutes(step))
	);

	// Get walk durations between consecutive steps
	const walksBetween = computeWalksBetween(steps);

	// Get departures for each transit step (fetch more for optimization)
	const allDepartures = await Promise.all(
		transitSteps.map(({ step }) =>
			getNextDepartures({
				stopId: step.fromStopId,
				feedId: step.feedId,
				routeId: step.routeId,
				directionId: step.directionId,
				travelMinutes: 0,
				maxWaitMinutes: step.maxWaitMinutes,
				limit: 15
			})
		)
	);

	// Walk minutes before first transit
	let walkBeforeFirst = 0;
	for (let i = 0; i < steps.length; i++) {
		if (steps[i].type === 'transit') break;
		if (steps[i].type === 'walk') walkBeforeFirst += (steps[i] as WalkStep).minutes;
	}

	// Walk minutes after last transit
	let walkAfterLast = 0;
	for (let i = steps.length - 1; i >= 0; i--) {
		if (steps[i].type === 'transit') break;
		if (steps[i].type === 'walk') walkAfterLast += (steps[i] as WalkStep).minutes;
	}

	if (transitSteps.length === 1) {
		// Single transit — no optimization needed, just return departures with timeline
		return allDepartures[0].slice(0, limit).map((dep) => {
			const depSec = effectiveTimeSec(dep);
			const leaveSec = depSec - (walkBeforeFirst + getMaxWait(transitSteps[0].step)) * 60;
			const arrivalSec = depSec + (rideDurations[0] ?? 0) * 60 + walkAfterLast * 60;

			return {
				departures: [{ ...dep, stepIndex: transitSteps[0].index }],
				leaveByTime: secToTime(leaveSec),
				totalWaitMinutes: 0,
				estimatedArrival: secToTime(arrivalSec),
				timeline: buildTimeline(steps, [dep], transitSteps, rideDurations, walkBeforeFirst, leaveSec)
			};
		});
	}

	// Multi-transit: enumerate combos
	const combos: OptimizedCombo[] = [];

	for (const firstDep of allDepartures[0]) {
		const combo: Departure[] = [firstDep];
		let totalWait = 0;
		let valid = true;

		let currentTimeSec = effectiveTimeSec(firstDep);

		for (let t = 1; t < transitSteps.length; t++) {
			// Time after ride + walk to next stop
			const rideMin = rideDurations[t - 1] ?? 0;
			const walkMin = walksBetween[t - 1] ?? 0;
			const arriveAtNextStopSec = currentTimeSec + (rideMin + walkMin) * 60;

			// Find earliest departure at next transit step after arrival
			const maxWaitSec = getMaxWait(transitSteps[t].step) * 60;

			const nextDep = allDepartures[t].find(
				(d) => effectiveTimeSec(d) >= arriveAtNextStopSec
			);

			if (!nextDep) {
				valid = false;
				break;
			}

			// Reject if wait at station exceeds max tolerable wait
			const waitSec = effectiveTimeSec(nextDep) - arriveAtNextStopSec;
			if (waitSec > maxWaitSec) {
				valid = false;
				break;
			}
			totalWait += waitSec / 60;
			combo.push(nextDep);
			currentTimeSec = effectiveTimeSec(nextDep);
		}

		if (!valid) continue;

		const firstDepSec = effectiveTimeSec(firstDep);
		const leaveSec = firstDepSec - (walkBeforeFirst + getMaxWait(transitSteps[0].step)) * 60;

		// Final arrival
		const lastRide = rideDurations[transitSteps.length - 1] ?? 0;
		const lastDepSec = effectiveTimeSec(combo[combo.length - 1]);
		const arrivalSec = lastDepSec + lastRide * 60 + walkAfterLast * 60;

		combos.push({
			departures: combo.map((dep, i) => ({ ...dep, stepIndex: transitSteps[i].index })),
			leaveByTime: secToTime(leaveSec),
			totalWaitMinutes: Math.round(totalWait),
			estimatedArrival: secToTime(arrivalSec),
			timeline: buildTimeline(steps, combo, transitSteps, rideDurations, walkBeforeFirst, leaveSec)
		});
	}

	// Sort by total wait time, take top N
	combos.sort((a, b) => a.totalWaitMinutes - b.totalWaitMinutes);
	return combos.slice(0, limit);
}

/** Get walk minutes between consecutive transit steps */
function computeWalksBetween(steps: Step[]): number[] {
	const walks: number[] = [];
	let accumulatedWalk = 0;
	let seenFirstTransit = false;

	for (const step of steps) {
		if (step.type === 'transit') {
			if (seenFirstTransit) {
				walks.push(accumulatedWalk);
				accumulatedWalk = 0;
			}
			seenFirstTransit = true;
		} else if (step.type === 'walk' && seenFirstTransit) {
			accumulatedWalk += (step as WalkStep).minutes;
		}
	}

	return walks;
}

/** Estimate ride duration from GTFS stop_times template */
async function getRideDurationMinutes(transit: TransitStep): Promise<number> {
	if (!transit.toStopId) return 0;

	const db = getDb();

	// Find a trip for this route/direction
	const trip = db
		.prepare(
			`SELECT trip_id FROM trips
			 WHERE route_id = ? AND feed_id = ? AND direction_id = ?
			 LIMIT 1`
		)
		.get(transit.routeId, transit.feedId, transit.directionId) as { trip_id: string } | undefined;

	if (!trip) return 0;

	const fromSt = db
		.prepare('SELECT departure_time FROM stop_times WHERE trip_id = ? AND feed_id = ? AND stop_id = ?')
		.get(trip.trip_id, transit.feedId, transit.fromStopId) as { departure_time: string } | undefined;

	const toSt = db
		.prepare('SELECT arrival_time FROM stop_times WHERE trip_id = ? AND feed_id = ? AND stop_id = ?')
		.get(trip.trip_id, transit.feedId, transit.toStopId) as { arrival_time: string } | undefined;

	if (!fromSt || !toSt) return 0;

	return Math.max(1, Math.round((timeToSec(toSt.arrival_time) - timeToSec(fromSt.departure_time)) / 60));
}

function buildTimeline(
	steps: Step[],
	comboDeps: Departure[],
	transitSteps: { step: TransitStep; index: number }[],
	rideDurations: number[],
	walkBeforeFirst: number,
	leaveSec: number
): TimelineEntry[] {
	const entries: TimelineEntry[] = [];
	let currentSec = leaveSec;
	let transitIdx = 0;

	entries.push({ time: fmtSec(currentSec), timeSec: currentSec, label: 'Leave', stepIndex: -1, type: 'leave' });

	for (let i = 0; i < steps.length; i++) {
		const step = steps[i];

		if (step.type === 'walk') {
			const walk = step as WalkStep;
			currentSec += walk.minutes * 60;
			entries.push({
				time: fmtSec(currentSec),
				timeSec: currentSec,
				label: walk.description || 'Walk',
				stepIndex: i,
				type: 'walk'
			});
		} else if (step.type === 'transit') {
			const transit = step as TransitStep;
			const dep = comboDeps[transitIdx];

			// Buffer
			currentSec += (transit.maxWaitMinutes ?? getDefaultMaxWaitMinutes()) * 60;

			// Board at effective time (ETA-adjusted if available)
			const depSec = effectiveTimeSec(dep);
			if (depSec > currentSec) currentSec = depSec;

			entries.push({
				time: fmtSec(currentSec),
				timeSec: currentSec,
				label: `Board at ${transit.fromStopId}`,
				stepIndex: i,
				type: 'board'
			});

			// Ride
			const ride = rideDurations[transitIdx] ?? 0;
			currentSec += ride * 60;

			if (transit.toStopId) {
				entries.push({
					time: fmtSec(currentSec),
					timeSec: currentSec,
					label: `Alight at ${transit.toStopId}`,
					stepIndex: i,
					type: 'alight'
				});
			}

			transitIdx++;
		}
	}

	entries.push({ time: fmtSec(currentSec), timeSec: currentSec, label: 'Arrive', stepIndex: -1, type: 'arrive' });

	return entries;
}

/** Use ETA-adjusted time when available, otherwise scheduled */
function effectiveTimeSec(dep: Departure): number {
	return timeToSec(dep.estimatedTime ?? dep.departureTime);
}

function timeToSec(time: string): number {
	const [h, m, s] = time.split(':').map(Number);
	return h * 3600 + m * 60 + (s || 0);
}

function secToTime(sec: number): string {
	const h = Math.floor(sec / 3600);
	const m = Math.floor((sec % 3600) / 60);
	const s = sec % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtSec(sec: number): string {
	const h = Math.floor(sec / 3600) % 24;
	const m = Math.floor((sec % 3600) / 60);
	const ampm = h >= 12 ? 'PM' : 'AM';
	const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
	return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
