import type { Feed, VehiclePosition } from '$lib/types';
import protobuf from 'protobufjs';

const BASE_URL = 'https://api.data.gov.my';

const REALTIME_ENDPOINTS: Partial<Record<Feed, string>> = {
	'rapid-bus-kl': '/gtfs-realtime/vehicle-position/prasarana?category=rapid-bus-kl',
	'rapid-bus-mrtfeeder': '/gtfs-realtime/vehicle-position/prasarana?category=rapid-bus-mrtfeeder',
	ktmb: '/gtfs-realtime/vehicle-position/ktmb'
	// rapid-rail-kl has NO realtime feed (404)
};

// Cache: feed -> { positions, timestamp }
const cache = new Map<Feed, { positions: VehiclePosition[]; timestamp: number }>();
const CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Fetch vehicle positions for a feed. Returns cached data if fresh (<30s).
 * Returns null if the feed has no realtime endpoint.
 */
export async function fetchVehiclePositions(feed: Feed): Promise<VehiclePosition[] | null> {
	const endpoint = REALTIME_ENDPOINTS[feed];
	if (!endpoint) return null;

	// Check cache
	const cached = cache.get(feed);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
		return cached.positions;
	}

	try {
		const response = await fetch(`${BASE_URL}${endpoint}`, { redirect: 'follow', signal: AbortSignal.timeout(10_000) });
		if (!response.ok) return null;

		const buffer = Buffer.from(await response.arrayBuffer());
		const positions = parseVehiclePositions(buffer);

		cache.set(feed, { positions, timestamp: Date.now() });
		return positions;
	} catch (err) {
		console.error(`[realtime] Failed to fetch ${feed}:`, err);
		return cached?.positions ?? null; // Return stale cache on error
	}
}

/**
 * Check if a specific trip has a confirmed vehicle.
 */
export async function checkTripConfirmation(
	tripId: string,
	feedId: Feed
): Promise<{ status: 'confirmed' | 'unconfirmed'; vehicleId: string | null }> {
	const positions = await fetchVehiclePositions(feedId);
	if (!positions) return { status: 'unconfirmed', vehicleId: null };

	const vehicle = positions.find((p) => p.tripId === tripId);
	return vehicle
		? { status: 'confirmed', vehicleId: vehicle.vehicleId || null }
		: { status: 'unconfirmed', vehicleId: null };
}

// Parse proto schema once at module level
const FeedMessageType = protobuf.parse(`
	syntax = "proto2";
	message FeedMessage {
		required FeedHeader header = 1;
		repeated FeedEntity entity = 2;
	}
	message FeedHeader {
		required string gtfs_realtime_version = 1;
		optional Incrementality incrementality = 2;
		optional uint64 timestamp = 3;
		enum Incrementality { FULL_DATASET = 0; DIFFERENTIAL = 1; }
	}
	message FeedEntity {
		required string id = 1;
		optional VehiclePosition vehicle = 4;
	}
	message VehiclePosition {
		optional TripDescriptor trip = 1;
		optional Position position = 2;
		optional uint64 timestamp = 5;
		optional VehicleDescriptor vehicle = 8;
	}
	message TripDescriptor {
		optional string trip_id = 1;
		optional string start_time = 2;
		optional string start_date = 3;
		optional string route_id = 5;
	}
	message Position {
		required float latitude = 1;
		required float longitude = 2;
		optional float bearing = 3;
		optional float speed = 5;
	}
	message VehicleDescriptor {
		optional string id = 1;
		optional string label = 2;
		optional string license_plate = 3;
	}
`).root.lookupType('FeedMessage');

function parseVehiclePositions(buffer: Buffer): VehiclePosition[] {
	const message = FeedMessageType.decode(buffer) as any;

	const positions: VehiclePosition[] = [];
	for (const entity of message.entity ?? []) {
		const v = entity.vehicle;
		if (!v?.position || !v?.trip) continue;

		positions.push({
			vehicleId: v.vehicle?.id ?? v.vehicle?.licensePlate ?? '',
			tripId: v.trip.tripId ?? '',
			routeId: v.trip.routeId ?? null,
			latitude: v.position.latitude,
			longitude: v.position.longitude,
			bearing: v.position.bearing ?? 0,
			speed: v.position.speed ?? 0,
			timestamp: Number(v.timestamp ?? 0)
		});
	}

	return positions;
}
