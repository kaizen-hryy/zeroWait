# GTFS Data Shape Analysis

**Date:** 2026-04-12
**Feeds analyzed:** rapid-rail-kl, rapid-bus-kl, rapid-bus-mrtfeeder, ktmb

---

## GTFS Realtime API (Vehicle Positions)

**Available endpoints (HTTP 200):**

| Feed | URL | Entities (sample) | Update freq |
|------|-----|-------------------|-------------|
| rapid-bus-kl | `/gtfs-realtime/vehicle-position/prasarana?category=rapid-bus-kl` | 97 vehicles | 30s |
| rapid-bus-mrtfeeder | `/gtfs-realtime/vehicle-position/prasarana?category=rapid-bus-mrtfeeder` | 88 vehicles | 30s |
| ktmb | `/gtfs-realtime/vehicle-position/ktmb` | 6 vehicles | 30s |

**NOT available (404):**
- `rapid-rail-kl` — **no realtime feed for rail at all**
- Trip updates — all endpoints return 404
- Service alerts — all endpoints return 404

### Vehicle Position Entity Shape (protobuf → JSON)

```json
{
  "id": "0",
  "vehicle": {
    "trip": {
      "tripId": "weekend_U5810_U581002_1",   // matches trips.txt trip_id
      "startTime": "11:40:49",                // only in bus-kl
      "startDate": "20260412",                // only in bus-kl
      "routeId": "U5810"                      // only in bus-kl & mrtfeeder
    },
    "position": {
      "latitude": 3.066864,
      "longitude": 101.71346,
      "bearing": 203.2,                       // degrees
      "speed": 9.07                           // m/s
    },
    "timestamp": "1775966109",                // unix epoch
    "vehicle": {
      "id": "W5623V",
      "licensePlate": "W5623V",               // bus-kl & mrtfeeder
      "label": "SCS17"                        // ktmb only
    }
  }
}
```

### Field availability per feed

| Field | rapid-bus-kl | rapid-bus-mrtfeeder | ktmb |
|-------|:---:|:---:|:---:|
| trip.tripId | yes | yes | yes |
| trip.startTime | yes | no | no |
| trip.startDate | yes | no | no |
| trip.routeId | yes | yes | no |
| position.latitude | yes | yes | yes |
| position.longitude | yes | yes | yes |
| position.bearing | yes | yes | yes (always 0) |
| position.speed | yes | yes | yes |
| vehicle.id | yes | yes | yes |
| vehicle.licensePlate | yes | yes | no |
| vehicle.label | no | no | yes |

### Implications for zeroWait

1. **Rail has NO realtime data** — we're purely schedule-based for LRT/MRT/Monorail. This is fine since rail is highly punctual.
2. **Bus vehicle positions can estimate proximity** — given a bus's lat/lon and the stop's lat/lon, we could estimate "bus is X stops away" or "bus is ~Y min away." This is a v2 enhancement.
3. **tripId in realtime matches trips.txt** — we can join realtime positions to static schedule data.
4. **KTMB realtime is sparse** — only 6 vehicles tracked at sample time. Limited utility.

---

## Summary of Scheduling Models

| Feed | Scheduling Model | stop_times rows | trips | Has frequencies.txt |
|------|-----------------|-----------------|-------|-------------------|
| **rapid-rail-kl** | Frequency-based | 1,001 | 41 | Yes (91 entries) |
| **rapid-bus-kl** | Frequency-based (99.8%) | 86,928 | 2,044 | Yes (2,041 trips) |
| **rapid-bus-mrtfeeder** | Schedule-based (exact times) | 174,207 | 6,228 | No |
| **ktmb** | Schedule-based (exact times) | 4,581 | 304 | No |

### What this means

**Two distinct approaches needed:**

1. **Frequency-based (rail, bus-kl):** `stop_times.txt` contains ONE template trip per route/direction/service_day. `frequencies.txt` defines how often that trip repeats. To get actual departure times, you generate them:
   ```
   For each frequency window (start_time, end_time, headway_secs):
     departure = start_time
     while departure < end_time:
       actual_stop_time = stop_time_offset + departure - trip_start_time
       departure += headway_secs
   ```

2. **Schedule-based (mrtfeeder, ktmb):** Each trip in `stop_times.txt` has exact, real departure times. Query directly.

---

## File Schemas Per Feed

### agency.txt

| Field | rapid-rail-kl | rapid-bus-kl | rapid-bus-mrtfeeder | ktmb |
|-------|:---:|:---:|:---:|:---:|
| agency_id | yes | yes | **NO** | yes |
| agency_name | yes | yes | yes | yes |
| agency_url | yes | yes | yes | yes |
| agency_timezone | yes | yes | yes | yes |
| agency_phone | yes | yes | yes | yes |
| agency_lang | yes | yes | yes | yes |

**Note:** MRT feeder has no `agency_id`. Need to assign one during import.

### routes.txt

| Field | rapid-rail-kl | rapid-bus-kl | rapid-bus-mrtfeeder | ktmb |
|-------|:---:|:---:|:---:|:---:|
| route_id | yes | yes | yes | yes |
| agency_id | yes | yes | yes (empty) | yes |
| route_short_name | yes | yes | **NO** | yes |
| route_long_name | yes | yes | **NO** | yes |
| route_desc | yes | — | — | yes |
| route_type | yes | yes | yes | yes |
| route_color | yes | yes | — | yes |
| route_text_color | yes | yes | — | yes |
| category | yes | — | — | — |
| status | yes | — | — | — |

**Rail route_types:** 1 (Rail)
**Bus route_types:** 3 (Bus)
**KTMB route_types:** 0 (Tram/Light Rail — should be 2 for Rail, but this is what they use)

**Rail lines (from routes.txt):**
- `AG` — LRT Ampang Line (color: #e57200)
- `KJ` — LRT Kelana Jaya Line (color: #D50032)
- `PH` — LRT Sri Petaling Line (color: #76232f)
- `KGL` — MRT Kajang Line (color: #047940)
- `PYL` — MRT Putrajaya Line
- `MRL` — KL Monorail

**MRT feeder issue:** `route_short_name` and `route_long_name` are missing. Only has route_id and a short name like "T117" in an unlabeled column. Need special handling.

### stops.txt

| Field | rapid-rail-kl | rapid-bus-kl | rapid-bus-mrtfeeder | ktmb |
|-------|:---:|:---:|:---:|:---:|
| stop_id | yes | yes | yes | yes |
| stop_code | — | — | yes | — |
| stop_name | yes | yes | yes | yes |
| stop_desc | — | yes | — | — |
| stop_lat | yes | yes | yes | yes |
| stop_lon | yes | yes | yes | yes |
| category | yes | — | — | — |
| route_id | yes | — | — | — |
| isOKU | yes | — | — | — |
| status | yes | — | — | — |
| search | yes | — | — | — |

**Row counts:**
- Rail: 166 stops
- Bus KL: 3,760 stops
- MRT Feeder: 2,109 stops
- KTMB: 191 stops
- **Total: ~6,226 stops**

**Rail stops have extra fields** (category, route_id, search) that are useful for filtering.

### trips.txt

| Field | rapid-rail-kl | rapid-bus-kl | rapid-bus-mrtfeeder | ktmb |
|-------|:---:|:---:|:---:|:---:|
| route_id | yes | yes | yes | yes |
| service_id | yes | yes | yes | yes |
| trip_id | yes | yes | yes | yes |
| trip_headsign | yes | yes (often empty) | yes | — |
| direction_id | yes | yes | yes | yes |
| shape_id | yes | yes | yes | — |

**Direction convention:** 0 = outbound, 1 = inbound (standard GTFS).

### stop_times.txt

| Field | rapid-rail-kl | rapid-bus-kl | rapid-bus-mrtfeeder | ktmb |
|-------|:---:|:---:|:---:|:---:|
| route_id | yes | — | — | — |
| direction_id | yes | — | — | — |
| trip_id | yes | yes | yes | yes |
| arrival_time | yes | yes | yes | yes |
| departure_time | yes | yes | yes | yes |
| stop_id | yes | yes | yes | yes |
| stop_sequence | yes | yes | yes | yes |
| stop_headsign | — | yes (empty) | yes | — |
| shape_dist_traveled | — | — | yes | yes |

**Important:** Rail stop_times includes `route_id` and `direction_id` as extra columns (non-standard GTFS). Other feeds require joining through trips.txt to get route/direction.

**Time format:** `H:MM:SS` or `HH:MM:SS` (rail uses no leading zero: `6:00:00`). Can exceed 24:00:00 for late-night services (GTFS standard).

### calendar.txt

| Field | All feeds |
|-------|:---------:|
| service_id | yes |
| monday-sunday | yes (1/0) |
| start_date | yes (YYYYMMDD) |
| end_date | yes (YYYYMMDD) |

**Service IDs by feed:**
- **Rail:** `MonFri`, `Sat`, `Sun`, `SatSun`, `MonThu`, `Fri`, `weekday`, `weekend`
- **Bus KL:** `weekday`, `weekend`
- **MRT Feeder:** `26031301` (Mon-Fri), `26031302` (Fri-Sun) — numeric IDs
- **KTMB:** `komuter_weekday`, `komuter_weekend`, `komuter_utara`, `ets`, `intercity`

### calendar_dates.txt (exceptions)

Only present in **rapid-bus-mrtfeeder**. 4 entries marking exception days (exception_type=2 means service removed on that date).

### frequencies.txt

| Field | rapid-rail-kl | rapid-bus-kl |
|-------|:---:|:---:|
| trip_id | yes | yes |
| start_time | yes | yes |
| end_time | yes | yes |
| headway_secs | yes | yes |
| exact_times | — | yes (always 0) |

**exact_times=0** means frequency-based (not exact schedule). Departures are approximate intervals.

**Rail headways:**
- Peak (6-9am, 5-7pm): 180s = 3 min
- Off-peak: 300s = 5 min

**Bus KL headways:** Vary by route, typically 1200-3600s (20-60 min).

---

## Key Implications for Implementation

### 1. Departure Time Generation

Two code paths needed:

**Frequency-based (rail, most bus-kl):**
```
Given: stop_id, route_id, direction_id, service_id, current_time
1. Find the template trip matching route/direction/service
2. Find stop_sequence offset for this stop in stop_times
3. Get all frequency windows for this trip
4. Generate departures: for each window, start at window.start + stop_offset, increment by headway
5. Filter to departures after current_time
```

**Schedule-based (mrtfeeder, ktmb):**
```
Given: stop_id, service_id, current_time
1. Query stop_times WHERE stop_id = X
2. Join trips to get route_id, direction_id
3. Filter by active service_id for today
4. Filter departure_time > current_time
5. Order by departure_time, LIMIT N
```

### 2. Service Day Resolution

To determine which service_id is active:
1. Get current date
2. Check calendar.txt: does service run on this weekday AND is date within start_date/end_date?
3. Check calendar_dates.txt for exceptions (only mrtfeeder has these)

### 3. Stop → Route Mapping

Not straightforward across feeds:
- **Rail:** stops.txt has route_id directly (non-standard but convenient)
- **Others:** Must derive from stop_times → trips → routes join

### 4. Direction Naming

- **Rail:** trip_headsign is descriptive ("From Ampang to Sentul Timur")
- **MRT Feeder:** trip_headsign present ("MRT SURIAN - SEK 11 KOTA DAMANSARA")
- **Bus KL:** trip_headsign often empty — need to derive from first/last stop name
- **KTMB:** No trip_headsign — derive from route_long_name + direction_id

### 5. Data Volume for SQLite

| Table | Estimated rows (all feeds) |
|-------|--------------------------|
| stops | ~6,200 |
| routes | ~230 |
| trips | ~8,600 |
| stop_times | ~266,700 |
| calendar | ~15 |
| calendar_dates | ~5 |
| frequencies | ~2,130 |

Total is modest — SQLite handles this trivially. Full dataset fits in memory.

### 6. Column Inconsistencies to Normalize

- Rail stop_times has extra `route_id`, `direction_id` columns — strip or keep as optimization
- MRT feeder has no agency_id — assign `mrtfeeder` during import
- MRT feeder routes missing short/long names — use route_short_name from column 4
- Time format varies (`6:00:00` vs `06:00:00`) — normalize to `HH:MM:SS`
- Rail stop_times has BOM character (`\ufeff`) — strip during parse
