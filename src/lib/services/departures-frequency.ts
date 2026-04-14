import type { Feed, Departure, GtfsFrequency } from '$lib/types';
import { getDb } from '$lib/db/connection';

interface FrequencyDepartureParams {
	stopId: string;
	feedId: Feed;
	routeId: string;
	directionId: number;
	serviceIds: string[];
	afterTime: string; // HH:MM:SS
	limit: number;
}

/**
 * Generate departures for frequency-based feeds (rail, bus-kl).
 *
 * Algorithm:
 * 1. Find template trip(s) matching route/direction/service
 * 2. Get the stop's time offset from trip start via stop_times
 * 3. For each frequency window, generate departures at headway intervals
 * 4. Filter to departures after afterTime
 */
export function getFrequencyDepartures(params: FrequencyDepartureParams): Departure[] {
	const { stopId, feedId, routeId, directionId, serviceIds, afterTime, limit } = params;
	if (serviceIds.length === 0) return [];

	const db = getDb();
	const placeholders = serviceIds.map(() => '?').join(',');

	// Find template trips matching route/direction/service
	const trips = db
		.prepare(
			`SELECT trip_id, service_id, trip_headsign FROM trips
			 WHERE feed_id = ? AND route_id = ? AND direction_id = ?
			 AND service_id IN (${placeholders})`
		)
		.all(feedId, routeId, directionId, ...serviceIds) as {
		trip_id: string;
		service_id: string;
		trip_headsign: string | null;
	}[];

	if (trips.length === 0) return [];

	const departures: Departure[] = [];

	for (const trip of trips) {
		// Get stop_times for this trip to find the stop's offset
		const stopTime = db
			.prepare(
				`SELECT departure_time, stop_sequence FROM stop_times
				 WHERE trip_id = ? AND feed_id = ? AND stop_id = ?`
			)
			.get(trip.trip_id, feedId, stopId) as
			| { departure_time: string; stop_sequence: number }
			| undefined;

		if (!stopTime) continue;

		// Get the trip's first stop time (the base time)
		const firstStopTime = db
			.prepare(
				`SELECT departure_time FROM stop_times
				 WHERE trip_id = ? AND feed_id = ?
				 ORDER BY stop_sequence ASC LIMIT 1`
			)
			.get(trip.trip_id, feedId) as { departure_time: string } | undefined;

		if (!firstStopTime) continue;

		// Calculate offset: how many seconds after trip start does this stop occur
		const baseSeconds = timeToSeconds(firstStopTime.departure_time);
		const stopSeconds = timeToSeconds(stopTime.departure_time);
		const offsetSeconds = stopSeconds - baseSeconds;

		// Get frequency windows for this trip
		const frequencies = db
			.prepare(
				`SELECT start_time, end_time, headway_secs FROM frequencies
				 WHERE trip_id = ? AND feed_id = ?
				 ORDER BY start_time`
			)
			.all(trip.trip_id, feedId) as GtfsFrequency[];

		const afterSeconds = timeToSeconds(afterTime);

		// Generate departures for each frequency window
		for (const freq of frequencies) {
			if (!freq.headway_secs || freq.headway_secs <= 0) continue;
			const windowStart = timeToSeconds(freq.start_time);
			const windowEnd = timeToSeconds(freq.end_time);

			// Each trip starts at windowStart, then windowStart + headway, etc.
			// The stop departure = tripStart + offsetSeconds
			let tripStart = windowStart;
			while (tripStart < windowEnd) {
				const stopDeparture = tripStart + offsetSeconds;
				if (stopDeparture >= afterSeconds) {
					departures.push({
						departureTime: secondsToTime(stopDeparture),
						leaveByTime: null, // computed by caller
						tripId: trip.trip_id,
						routeId,
						feedId,
						headsign: trip.trip_headsign,
						confirmed: null,
					vehicleId: null,
					estimatedTime: null,
					delayMinutes: null,
					grace: false,
					stationWaitMinutes: null
					});
				}
				tripStart += freq.headway_secs;
			}
		}
	}

	// Sort and limit
	departures.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
	return departures.slice(0, limit);
}

export function timeToSeconds(time: string): number {
	const [h, m, s] = time.split(':').map(Number);
	return h * 3600 + m * 60 + (s || 0);
}

export function secondsToTime(totalSeconds: number): string {
	const h = Math.floor(totalSeconds / 3600);
	const m = Math.floor((totalSeconds % 3600) / 60);
	const s = totalSeconds % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
