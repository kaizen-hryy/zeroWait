// === Feed & Scheduling Model ===

export type Feed = 'rapid-rail-kl' | 'rapid-bus-kl' | 'rapid-bus-mrtfeeder' | 'ktmb';

export type SchedulingModel = 'frequency' | 'schedule';

export const FEED_CONFIG: Record<Feed, { schedulingModel: SchedulingModel; label: string }> = {
	'rapid-rail-kl': { schedulingModel: 'frequency', label: 'Prasarana Rail (KL)' },
	'rapid-bus-kl': { schedulingModel: 'frequency', label: 'RapidKL Bus' },
	'rapid-bus-mrtfeeder': { schedulingModel: 'schedule', label: 'MRT Feeder Bus' },
	ktmb: { schedulingModel: 'schedule', label: 'KTMB' }
};

// === GTFS Row Types (normalized, matching DB schema) ===

export interface GtfsStop {
	stop_id: string;
	feed_id: Feed;
	stop_name: string;
	stop_lat: number;
	stop_lon: number;
	stop_code: string | null;
}

export interface GtfsRoute {
	route_id: string;
	feed_id: Feed;
	agency_id: string;
	route_short_name: string;
	route_long_name: string;
	route_type: number;
	route_color: string | null;
	route_text_color: string | null;
}

export interface GtfsTrip {
	trip_id: string;
	feed_id: Feed;
	route_id: string;
	service_id: string;
	direction_id: number;
	trip_headsign: string | null;
	shape_id: string | null;
}

export interface GtfsStopTime {
	trip_id: string;
	feed_id: Feed;
	stop_id: string;
	stop_sequence: number;
	arrival_time: string; // HH:MM:SS (normalized, can exceed 24:00:00)
	departure_time: string; // HH:MM:SS (normalized, can exceed 24:00:00)
	shape_dist_traveled: number | null; // km along shape
}

export interface GtfsShape {
	shape_id: string;
	feed_id: Feed;
	shape_pt_lat: number;
	shape_pt_lon: number;
	shape_pt_sequence: number;
	shape_dist_traveled: number | null;
}

export interface GtfsCalendar {
	service_id: string;
	feed_id: Feed;
	monday: number;
	tuesday: number;
	wednesday: number;
	thursday: number;
	friday: number;
	saturday: number;
	sunday: number;
	start_date: string; // YYYYMMDD
	end_date: string; // YYYYMMDD
}

export interface GtfsCalendarDate {
	service_id: string;
	feed_id: Feed;
	date: string; // YYYYMMDD
	exception_type: number; // 1 = added, 2 = removed
}

export interface GtfsFrequency {
	trip_id: string;
	feed_id: Feed;
	start_time: string; // HH:MM:SS
	end_time: string; // HH:MM:SS
	headway_secs: number;
}

// === App Types ===

export interface Departure {
	departureTime: string; // HH:MM:SS
	leaveByTime: string | null; // HH:MM:SS (computed: latest time to leave and still catch this)
	tripId: string;
	routeId: string;
	feedId: Feed;
	headsign: string | null;
	confirmed: boolean | null; // true = vehicle active, false = unconfirmed, null = N/A (rail)
	vehicleId: string | null; // license plate or vehicle label (buses only, when confirmed)
	estimatedTime: string | null; // HH:MM:SS GPS-based ETA (buses only, when confirmed)
	delayMinutes: number | null; // positive = late, negative = early, null = no data
	grace: boolean; // true = leave-by passed but within user-defined grace period, might still make it
	stationWaitMinutes: number | null; // computed: how long you'd wait at the station
}

// === Journey Step Types ===

export interface WalkStep {
	type: 'walk';
	description: string; // e.g. "Walk to Bangsar LRT", "Walk to office"
	minutes: number;
}

export interface TransitStep {
	type: 'transit';
	feedId: Feed;
	routeId: string;
	fromStopId: string;
	toStopId: string;
	directionId: number; // auto-detected from fromStop → toStop
	maxWaitMinutes: number | null; // max acceptable wait at station, null = use global default
}

export type Step = WalkStep | TransitStep;

/** @deprecated Use Step[] instead. Kept for migration compatibility. */
export interface Leg {
	stopId: string;
	feedId: Feed;
	routeId: string;
	directionId: number;
	travelMinutes: number;
	bufferMinutes: number;
}

export interface Profile {
	id: string;
	name: string;
	groupId: string | null; // null = ungrouped
	steps: Step[];
}

export interface ProfileGroup {
	id: string;
	name: string;
	profiles: Profile[];
}

// === Active Trip (persisted in localStorage) ===

export interface ActiveTripStep {
	timeSec: number; // estimated time in seconds from midnight
	time: string; // formatted e.g. "7:14 AM"
	label: string;
	type: 'leave' | 'walk' | 'board' | 'alight' | 'arrive';
	stopCode?: string;
	stopName?: string;
	routeColor?: string;
	routeLabel?: string;
	durationMin?: number; // walk duration or ride duration
}

export interface ActiveTrip {
	profileId: string;
	profileName: string;
	startedAt: number; // unix ms
	steps: ActiveTripStep[];
	estimatedArrivalSec: number; // seconds from midnight
	timezone?: string; // IANA timezone
}

export interface VehiclePosition {
	vehicleId: string;
	tripId: string;
	routeId: string | null;
	latitude: number;
	longitude: number;
	bearing: number;
	speed: number; // m/s
	timestamp: number; // unix epoch
}
