-- zeroWait SQLite Schema

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Feed metadata
CREATE TABLE IF NOT EXISTS feeds (
    feed_id TEXT PRIMARY KEY,
    scheduling_model TEXT NOT NULL, -- 'frequency' or 'schedule'
    last_updated TEXT -- ISO 8601
);

-- GTFS stops
CREATE TABLE IF NOT EXISTS stops (
    stop_id TEXT NOT NULL,
    feed_id TEXT NOT NULL,
    stop_name TEXT NOT NULL,
    stop_lat REAL NOT NULL,
    stop_lon REAL NOT NULL,
    stop_code TEXT,
    PRIMARY KEY (stop_id, feed_id)
);

-- GTFS routes
CREATE TABLE IF NOT EXISTS routes (
    route_id TEXT NOT NULL,
    feed_id TEXT NOT NULL,
    agency_id TEXT,
    route_short_name TEXT,
    route_long_name TEXT,
    route_type INTEGER NOT NULL,
    route_color TEXT,
    route_text_color TEXT,
    PRIMARY KEY (route_id, feed_id)
);

-- GTFS trips
CREATE TABLE IF NOT EXISTS trips (
    trip_id TEXT NOT NULL,
    feed_id TEXT NOT NULL,
    route_id TEXT NOT NULL,
    service_id TEXT NOT NULL,
    direction_id INTEGER NOT NULL,
    trip_headsign TEXT,
    shape_id TEXT,
    PRIMARY KEY (trip_id, feed_id)
);

-- GTFS stop_times
CREATE TABLE IF NOT EXISTS stop_times (
    trip_id TEXT NOT NULL,
    feed_id TEXT NOT NULL,
    stop_id TEXT NOT NULL,
    stop_sequence INTEGER NOT NULL,
    arrival_time TEXT NOT NULL,   -- HH:MM:SS (can exceed 24:00:00)
    departure_time TEXT NOT NULL, -- HH:MM:SS (can exceed 24:00:00)
    shape_dist_traveled REAL,    -- distance along shape to this stop (km)
    PRIMARY KEY (trip_id, feed_id, stop_sequence)
);

-- GTFS calendar (service days)
CREATE TABLE IF NOT EXISTS calendar (
    service_id TEXT NOT NULL,
    feed_id TEXT NOT NULL,
    monday INTEGER NOT NULL,
    tuesday INTEGER NOT NULL,
    wednesday INTEGER NOT NULL,
    thursday INTEGER NOT NULL,
    friday INTEGER NOT NULL,
    saturday INTEGER NOT NULL,
    sunday INTEGER NOT NULL,
    start_date TEXT NOT NULL, -- YYYYMMDD
    end_date TEXT NOT NULL,   -- YYYYMMDD
    PRIMARY KEY (service_id, feed_id)
);

-- GTFS calendar_dates (exceptions)
CREATE TABLE IF NOT EXISTS calendar_dates (
    service_id TEXT NOT NULL,
    feed_id TEXT NOT NULL,
    date TEXT NOT NULL,        -- YYYYMMDD
    exception_type INTEGER NOT NULL, -- 1=added, 2=removed
    PRIMARY KEY (service_id, feed_id, date)
);

-- GTFS shapes (route polylines for GPS matching)
CREATE TABLE IF NOT EXISTS shapes (
    shape_id TEXT NOT NULL,
    feed_id TEXT NOT NULL,
    shape_pt_lat REAL NOT NULL,
    shape_pt_lon REAL NOT NULL,
    shape_pt_sequence INTEGER NOT NULL,
    shape_dist_traveled REAL, -- cumulative distance in km
    PRIMARY KEY (shape_id, feed_id, shape_pt_sequence)
);

CREATE INDEX IF NOT EXISTS idx_shapes_id ON shapes(shape_id, feed_id);

-- GTFS frequencies (for frequency-based feeds)
CREATE TABLE IF NOT EXISTS frequencies (
    trip_id TEXT NOT NULL,
    feed_id TEXT NOT NULL,
    start_time TEXT NOT NULL,  -- HH:MM:SS
    end_time TEXT NOT NULL,    -- HH:MM:SS
    headway_secs INTEGER NOT NULL,
    PRIMARY KEY (trip_id, feed_id, start_time)
);

-- Profile groups
CREATE TABLE IF NOT EXISTS profile_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

-- User profiles
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    group_id TEXT,
    data TEXT NOT NULL, -- JSON blob: { steps: Step[] }
    FOREIGN KEY (group_id) REFERENCES profile_groups(id) ON DELETE SET NULL
);

-- App settings (key-value)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Default max wait at station (minutes)
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_max_wait_minutes', '5');

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_stop_times_stop ON stop_times(stop_id, feed_id);
CREATE INDEX IF NOT EXISTS idx_stop_times_trip ON stop_times(trip_id, feed_id);
CREATE INDEX IF NOT EXISTS idx_trips_route_service ON trips(route_id, feed_id, service_id);
CREATE INDEX IF NOT EXISTS idx_stops_name ON stops(stop_name);
CREATE INDEX IF NOT EXISTS idx_frequencies_trip ON frequencies(trip_id, feed_id);
