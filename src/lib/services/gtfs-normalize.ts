import type {
	Feed,
	GtfsStop,
	GtfsRoute,
	GtfsTrip,
	GtfsStopTime,
	GtfsCalendar,
	GtfsCalendarDate,
	GtfsFrequency,
	GtfsShape
} from '$lib/types';
import { parseCsv } from './gtfs-parse';

/** Normalize time from H:MM:SS or HH:MM:SS to always HH:MM:SS */
function normalizeTime(time: string): string {
	const parts = time.split(':');
	if (parts.length !== 3) return time;
	parts[0] = parts[0].padStart(2, '0');
	return parts.join(':');
}

export interface NormalizedGtfsData {
	stops: GtfsStop[];
	routes: GtfsRoute[];
	trips: GtfsTrip[];
	stopTimes: GtfsStopTime[];
	calendar: GtfsCalendar[];
	calendarDates: GtfsCalendarDate[];
	frequencies: GtfsFrequency[];
	shapes: GtfsShape[];
}

export function normalizeGtfsData(
	feed: Feed,
	files: Record<string, string>
): NormalizedGtfsData {
	const stops = normalizeStops(feed, files['stops.txt'] ?? '');
	const routes = normalizeRoutes(feed, files['routes.txt'] ?? '');
	const trips = normalizeTrips(feed, files['trips.txt'] ?? '', routes);
	const stopTimes = normalizeStopTimes(feed, files['stop_times.txt'] ?? '');
	const calendar = normalizeCalendar(feed, files['calendar.txt'] ?? '');
	const calendarDates = normalizeCalendarDates(feed, files['calendar_dates.txt'] ?? '');
	const frequencies = normalizeFrequencies(feed, files['frequencies.txt'] ?? '');
	const shapes = normalizeShapes(feed, files['shapes.txt'] ?? '');

	// Derive missing trip headsigns for bus-kl and ktmb
	if (feed === 'rapid-bus-kl' || feed === 'ktmb') {
		deriveHeadsigns(trips, stopTimes, stops, routes, feed);
	}

	return { stops, routes, trips, stopTimes, calendar, calendarDates, frequencies, shapes };
}

function normalizeStops(feed: Feed, content: string): GtfsStop[] {
	if (!content) return [];
	return parseCsv(content).map((row) => ({
		stop_id: row.stop_id,
		feed_id: feed,
		stop_name: row.stop_name,
		stop_lat: parseFloat(row.stop_lat),
		stop_lon: parseFloat(row.stop_lon),
		stop_code: row.stop_code || null
	}));
}

function normalizeRoutes(feed: Feed, content: string): GtfsRoute[] {
	if (!content) return [];
	return parseCsv(content).map((row) => {
		let agencyId = row.agency_id || '';
		if (feed === 'rapid-bus-mrtfeeder' && !agencyId) {
			agencyId = 'mrtfeeder';
		}

		// MRT feeder has route_short_name in a non-standard column position
		let shortName = row.route_short_name || '';
		let longName = row.route_long_name || '';
		if (feed === 'rapid-bus-mrtfeeder') {
			// The 4th column (index 3) contains the short name like "T117"
			// parseCsv maps by header, so if headers don't include route_short_name,
			// we can try to use the route_id as a fallback or the unnamed column
			if (!shortName) {
				// route_short_name might be mapped to an empty header key
				// Fall back to values that look like route codes from other fields
				for (const [key, val] of Object.entries(row)) {
					if (key !== 'route_id' && key !== 'agency_id' && key !== 'route_type' && /^T\d+/.test(val)) {
						shortName = val;
						break;
					}
				}
			}
			if (!longName) longName = shortName;
		}

		return {
			route_id: row.route_id,
			feed_id: feed,
			agency_id: agencyId,
			route_short_name: shortName,
			route_long_name: longName,
			route_type: parseInt(row.route_type, 10),
			route_color: row.route_color || null,
			route_text_color: row.route_text_color || null
		};
	});
}

function normalizeTrips(feed: Feed, content: string, routes: GtfsRoute[]): GtfsTrip[] {
	if (!content) return [];
	return parseCsv(content).map((row) => ({
		trip_id: row.trip_id,
		feed_id: feed,
		route_id: row.route_id,
		service_id: row.service_id,
		direction_id: parseInt(row.direction_id, 10) || 0,
		trip_headsign: row.trip_headsign || null,
		shape_id: row.shape_id || null
	}));
}

function normalizeStopTimes(feed: Feed, content: string): GtfsStopTime[] {
	if (!content) return [];
	return parseCsv(content).map((row) => ({
		trip_id: row.trip_id,
		feed_id: feed,
		stop_id: row.stop_id,
		stop_sequence: parseInt(row.stop_sequence, 10),
		arrival_time: normalizeTime(row.arrival_time),
		departure_time: normalizeTime(row.departure_time),
		shape_dist_traveled: row.shape_dist_traveled ? parseFloat(row.shape_dist_traveled) : null
	}));
}

function normalizeCalendar(feed: Feed, content: string): GtfsCalendar[] {
	if (!content) return [];
	return parseCsv(content).map((row) => ({
		service_id: row.service_id,
		feed_id: feed,
		monday: parseInt(row.monday, 10),
		tuesday: parseInt(row.tuesday, 10),
		wednesday: parseInt(row.wednesday, 10),
		thursday: parseInt(row.thursday, 10),
		friday: parseInt(row.friday, 10),
		saturday: parseInt(row.saturday, 10),
		sunday: parseInt(row.sunday, 10),
		start_date: row.start_date,
		end_date: row.end_date
	}));
}

function normalizeCalendarDates(feed: Feed, content: string): GtfsCalendarDate[] {
	if (!content) return [];
	return parseCsv(content).map((row) => ({
		service_id: row.service_id,
		feed_id: feed,
		date: row.date,
		exception_type: parseInt(row.exception_type, 10)
	}));
}

function normalizeFrequencies(feed: Feed, content: string): GtfsFrequency[] {
	if (!content) return [];
	return parseCsv(content).map((row) => ({
		trip_id: row.trip_id,
		feed_id: feed,
		start_time: normalizeTime(row.start_time),
		end_time: normalizeTime(row.end_time),
		headway_secs: parseInt(row.headway_secs, 10)
	}));
}

function normalizeShapes(feed: Feed, content: string): GtfsShape[] {
	if (!content) return [];
	return parseCsv(content).map((row) => ({
		shape_id: row.shape_id,
		feed_id: feed,
		shape_pt_lat: parseFloat(row.shape_pt_lat),
		shape_pt_lon: parseFloat(row.shape_pt_lon),
		shape_pt_sequence: parseInt(row.shape_pt_sequence, 10),
		shape_dist_traveled: row.shape_dist_traveled ? parseFloat(row.shape_dist_traveled) : null
	}));
}

/** Derive missing trip headsigns from first/last stop or route name */
function deriveHeadsigns(
	trips: GtfsTrip[],
	stopTimes: GtfsStopTime[],
	stops: GtfsStop[],
	routes: GtfsRoute[],
	feed: Feed
): void {
	const tripsNeedingHeadsign = trips.filter((t) => !t.trip_headsign);
	if (tripsNeedingHeadsign.length === 0) return;

	// Build stop name lookup
	const stopNameMap = new Map(stops.map((s) => [s.stop_id, s.stop_name]));

	// Build route name lookup
	const routeNameMap = new Map(routes.map((r) => [r.route_id, r.route_long_name || r.route_short_name]));

	// Build trip → stop_ids sorted by stop_sequence
	const tripStops = new Map<string, { stop_id: string; seq: number }[]>();
	for (const st of stopTimes) {
		if (!tripStops.has(st.trip_id)) tripStops.set(st.trip_id, []);
		tripStops.get(st.trip_id)!.push({ stop_id: st.stop_id, seq: st.stop_sequence });
	}
	// Sort each trip's stops by sequence
	for (const [, entries] of tripStops) {
		entries.sort((a, b) => a.seq - b.seq);
	}

	for (const trip of tripsNeedingHeadsign) {
		if (feed === 'ktmb') {
			// Use route long name + direction
			const routeName = routeNameMap.get(trip.route_id) ?? trip.route_id;
			const dir = trip.direction_id === 0 ? 'Outbound' : 'Inbound';
			trip.trip_headsign = `${routeName} (${dir})`;
		} else {
			// Derive from last stop name
			const entries = tripStops.get(trip.trip_id);
			if (entries && entries.length > 0) {
				const lastStopId = entries[entries.length - 1].stop_id;
				const lastName = stopNameMap.get(lastStopId);
				if (lastName) {
					trip.trip_headsign = `To ${lastName}`;
				}
			}
		}
	}
}
