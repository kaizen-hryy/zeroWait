import type { Feed, VehiclePosition } from '$lib/types';
import { getDb } from '$lib/db/connection';
import { fetchVehiclePositions } from './realtime';
import { getTimezone } from './settings';

export interface EtaEstimate {
	tripId: string;
	vehicleId: string;
	scheduledTime: string; // HH:MM:SS
	estimatedTime: string; // HH:MM:SS
	delayMinutes: number; // positive = late, negative = early
	distanceKm: number; // remaining distance to stop
	speedKmh: number; // current speed
}

/**
 * Estimate arrival time for a bus at a specific stop using GPS position,
 * route shape, and current speed.
 */
export async function estimateArrival(
	tripId: string,
	feedId: Feed,
	stopId: string
): Promise<EtaEstimate | null> {
	// Only bus feeds have realtime
	if (feedId === 'rapid-rail-kl') return null;

	const positions = await fetchVehiclePositions(feedId);
	if (!positions) return null;

	const vehicle = positions.find((p) => p.tripId === tripId);
	if (!vehicle) return null;

	const db = getDb();

	// Get shape_id for this trip
	const trip = db
		.prepare('SELECT shape_id FROM trips WHERE trip_id = ? AND feed_id = ?')
		.get(tripId, feedId) as { shape_id: string | null } | undefined;

	if (!trip?.shape_id) return null;

	// Get shape points
	const shapePoints = db
		.prepare(
			`SELECT shape_pt_lat, shape_pt_lon, shape_pt_sequence, shape_dist_traveled
			 FROM shapes WHERE shape_id = ? AND feed_id = ?
			 ORDER BY shape_pt_sequence`
		)
		.all(trip.shape_id, feedId) as {
		shape_pt_lat: number;
		shape_pt_lon: number;
		shape_pt_sequence: number;
		shape_dist_traveled: number | null;
	}[];

	if (shapePoints.length < 2) return null;

	// Compute cumulative distances if not provided
	const distances = computeCumulativeDistances(shapePoints);

	// Find vehicle's position along the shape
	const vehicleShapeDist = projectPointOnShape(
		vehicle.latitude,
		vehicle.longitude,
		shapePoints,
		distances
	);

	// Get stop's distance along shape
	const stopShapeDist = getStopShapeDistance(tripId, feedId, stopId, shapePoints, distances);
	if (stopShapeDist === null) return null;

	// Remaining distance
	const remainingKm = stopShapeDist - vehicleShapeDist;
	if (remainingKm < 0) {
		// Vehicle has already passed this stop
		return null;
	}

	// Estimate time based on speed
	const speedKmh = vehicle.speed * 3.6; // m/s to km/h
	let etaMinutes: number;

	if (speedKmh < 3) {
		// Vehicle is stopped or crawling — use average bus speed of 20 km/h
		etaMinutes = (remainingKm / 20) * 60;
	} else {
		etaMinutes = (remainingKm / speedKmh) * 60;
	}

	// Get scheduled arrival time
	const stopTime = db
		.prepare(
			`SELECT arrival_time FROM stop_times
			 WHERE trip_id = ? AND feed_id = ? AND stop_id = ?`
		)
		.get(tripId, feedId, stopId) as { arrival_time: string } | undefined;

	if (!stopTime) return null;

	const nowSec = getCurrentTimeSec();
	const estimatedArrivalSec = nowSec + etaMinutes * 60;
	const scheduledSec = timeToSec(stopTime.arrival_time);
	const delayMinutes = Math.round((estimatedArrivalSec - scheduledSec) / 60);

	return {
		tripId,
		vehicleId: vehicle.vehicleId,
		scheduledTime: stopTime.arrival_time,
		estimatedTime: secToTime(estimatedArrivalSec),
		delayMinutes,
		distanceKm: Math.round(remainingKm * 10) / 10,
		speedKmh: Math.round(speedKmh)
	};
}

/** Compute cumulative distances along shape points (in km) */
function computeCumulativeDistances(
	points: { shape_pt_lat: number; shape_pt_lon: number; shape_dist_traveled: number | null }[]
): number[] {
	// If shape_dist_traveled is provided, use it
	if (points[0].shape_dist_traveled !== null) {
		return points.map((p) => p.shape_dist_traveled!);
	}

	// Otherwise compute from lat/lon
	const distances: number[] = [0];
	for (let i = 1; i < points.length; i++) {
		const d = haversineKm(
			points[i - 1].shape_pt_lat,
			points[i - 1].shape_pt_lon,
			points[i].shape_pt_lat,
			points[i].shape_pt_lon
		);
		distances.push(distances[i - 1] + d);
	}
	return distances;
}

/** Project a point onto the nearest segment of a polyline, return distance along shape */
function projectPointOnShape(
	lat: number,
	lon: number,
	points: { shape_pt_lat: number; shape_pt_lon: number }[],
	distances: number[]
): number {
	let minDist = Infinity;
	let projectedShapeDist = 0;

	for (let i = 0; i < points.length - 1; i++) {
		const { dist, t } = pointToSegmentDistance(
			lat,
			lon,
			points[i].shape_pt_lat,
			points[i].shape_pt_lon,
			points[i + 1].shape_pt_lat,
			points[i + 1].shape_pt_lon
		);

		if (dist < minDist) {
			minDist = dist;
			// Interpolate distance along shape
			projectedShapeDist = distances[i] + t * (distances[i + 1] - distances[i]);
		}
	}

	return projectedShapeDist;
}

/** Get stop's distance along the route shape */
function getStopShapeDistance(
	tripId: string,
	feedId: Feed,
	stopId: string,
	shapePoints: { shape_pt_lat: number; shape_pt_lon: number }[],
	distances: number[]
): number | null {
	const db = getDb();

	// Check if stop_times has shape_dist_traveled
	const st = db
		.prepare(
			`SELECT shape_dist_traveled FROM stop_times
			 WHERE trip_id = ? AND feed_id = ? AND stop_id = ?`
		)
		.get(tripId, feedId, stopId) as { shape_dist_traveled: number | null } | undefined;

	if (st?.shape_dist_traveled !== null && st?.shape_dist_traveled !== undefined) {
		return st.shape_dist_traveled;
	}

	// Fall back: project stop location onto shape
	const stop = db
		.prepare('SELECT stop_lat, stop_lon FROM stops WHERE stop_id = ? AND feed_id = ?')
		.get(stopId, feedId) as { stop_lat: number; stop_lon: number } | undefined;

	if (!stop) return null;

	return projectPointOnShape(stop.stop_lat, stop.stop_lon, shapePoints, distances);
}

/** Distance between a point and a line segment. Returns distance and t (0-1 projection parameter) */
function pointToSegmentDistance(
	px: number,
	py: number,
	ax: number,
	ay: number,
	bx: number,
	by: number
): { dist: number; t: number } {
	const dx = bx - ax;
	const dy = by - ay;
	const lenSq = dx * dx + dy * dy;

	let t = 0;
	if (lenSq > 0) {
		t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
		t = Math.max(0, Math.min(1, t));
	}

	const projX = ax + t * dx;
	const projY = ay + t * dy;
	const dist = haversineKm(px, py, projX, projY);

	return { dist, t };
}

/** Haversine distance in km */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
	return (deg * Math.PI) / 180;
}

function timeToSec(time: string): number {
	const [h, m, s] = time.split(':').map(Number);
	return h * 3600 + m * 60 + (s || 0);
}

function secToTime(sec: number): string {
	const h = Math.floor(sec / 3600);
	const m = Math.floor((sec % 3600) / 60);
	const s = Math.floor(sec % 60);
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getCurrentTimeSec(): number {
	const formatter = new Intl.DateTimeFormat('en-GB', {
		timeZone: getTimezone(),
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	});
	const [h, m, s] = formatter.format(new Date()).split(':').map(Number);
	return h * 3600 + m * 60 + s;
}
