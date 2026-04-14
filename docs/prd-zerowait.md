# zeroWait — Product Requirements Document

**Version:** 1.0
**Date:** 2026-04-12
**Status:** Draft

---

## 1. Vision

Eliminate wasted waiting time at Malaysian public transport stations by telling users exactly when to leave their current location.

## 2. Problem Statement

Commuters either arrive too early (wasting 5-15 minutes on a platform) or too late (missing the service, waiting for the next one). No tool currently combines "time to reach station" + "next departure" into a single actionable "leave at X:XX" answer personalized to a user's specific location and route.

## 3. Core Concept

```
Leave Time = Next Departure Time - Travel Time to Stop - Buffer
```

For multi-leg journeys, each leg is independently timed. The departure of the first leg determines when to leave.

## 4. Target User

- Personal use (single user, the developer)
- Malaysian public transport commuter, KL focus
- Knows their routes — needs timing, not route discovery

## 5. Data Source

**Malaysia Official Open API** — `https://api.data.gov.my` (no auth required)

### 5.1 GTFS Static (Available Now)

| Endpoint | Data | Update Frequency |
|----------|------|-----------------|
| `GET /gtfs-static/ktmb` | KTMB rail schedules | Daily at 00:01 UTC |
| `GET /gtfs-static/prasarana?category=rapid-rail-kl` | LRT/MRT/Monorail schedules | As needed |
| `GET /gtfs-static/prasarana?category=rapid-bus-kl` | RapidKL bus schedules | As needed |
| `GET /gtfs-static/prasarana?category=rapid-bus-mrtfeeder` | MRT feeder bus schedules | As needed |

Returns ZIP files containing: `agency.txt`, `stops.txt`, `routes.txt`, `trips.txt`, `stop_times.txt`, `calendar.txt`, and optionally `frequencies.txt`, `shapes.txt`.

**Refresh strategy:** Daily at 4am local time (before services begin), as recommended by the API docs.

### 5.2 GTFS Realtime (Partial — Vehicle Positions Only)

| Endpoint | Data | Update Frequency |
|----------|------|-----------------|
| `GET /gtfs-realtime/vehicle-position/ktmb` | KTMB train positions | Every 30s |
| `GET /gtfs-realtime/vehicle-position/prasarana?category=rapid-bus-kl` | RapidKL bus positions | Every 30s |

**Limitation:** Trip updates (arrival predictions) and service alerts are **not yet available** — planned for 2026. v1 relies on static schedules only.

### 5.3 Known Data Quality Issues

- ~2% of trips in `rapid-bus-kl` excluded from `stop_times.txt` due to operational issues
- Bus GPS data occasionally reports positions outside service areas (erroneous transponder data)
- Penang/Kuantan bus feeds have trip/route ID mismatches with static data (legacy system issues)
- KL rail and KL bus data is generally reliable

## 6. Transit Systems in Scope

### v1

| System | Type | API Category |
|--------|------|-------------|
| MRT Kajang Line | Rail | `rapid-rail-kl` |
| MRT Putrajaya Line | Rail | `rapid-rail-kl` |
| LRT Kelana Jaya Line | Rail | `rapid-rail-kl` |
| LRT Ampang/Sri Petaling Line | Rail | `rapid-rail-kl` |
| KL Monorail | Rail | `rapid-rail-kl` |
| KTMB Komuter | Rail | `ktmb` |
| RapidKL Bus | Bus | `rapid-bus-kl` |
| MRT Feeder Bus | Bus | `rapid-bus-mrtfeeder` |

## 7. Features

### 7.1 Stop Management

- Search stops by name from GTFS data
- View stop details: name, routes served, upcoming departures
- Filter stops by transit system (rail/bus)

### 7.2 Leg Configuration (Manual)

Each leg of a journey is manually configured:

- **Stop/Station:** Select from GTFS stops
- **Route & Direction:** Select which service and direction at that stop
- **Travel time to stop:** Manual input in minutes (walking, driving, etc.)
- **Buffer:** Flat additional minutes for safety margin

### 7.3 Multi-Leg Journey

- Chain multiple legs into a single journey
- Each leg configured independently
- v1: First leg's departure determines "leave by" time
- Transfer times between legs shown as info (not optimized)
- v2 (future): Smart optimization across all legs to minimize total wait

**Example:**
```
Leg 1: Walk 8min + 3min buffer → Bus 780 at Stop A
Leg 2: Bus arrives Stop B → Walk 2min → MRT Station X
Leg 3: MRT Station X → Station Y

Dashboard shows:
  "Leave by 7:39" (based on Bus 780 departing Stop A at 7:50)
  Transfer: Bus arrives Stop B ~8:05 → MRT options: 8:15, 8:25
```

### 7.4 Departure Calculation

- Fetch upcoming departures from static schedules (stop_times.txt)
- Calculate: `leave_at = first_leg_departure - travel_time - buffer`
- Show next 3-5 departures with corresponding "leave by" times
- Highlight the optimal one (soonest you can still catch)
- Visual status: "Leave now" / "X min until you should leave" / "Missed, next at..."

### 7.5 Realtime Confirmation (Bus Routes)

v1 uses a two-tier accuracy model combining static schedules with realtime vehicle positions:

**Tier 1 — Schedule only (Rail):**
Rail has no realtime API. Schedules are used as-is. Rail is highly punctual so this is acceptable.

**Tier 2 — Schedule + trip confirmation (Bus):**
When the dashboard is active, poll GTFS Realtime vehicle positions every 30s for bus routes. Match `tripId` from realtime data to scheduled trips:
- **Vehicle found for trip** → "Bus T102 is active" (high confidence, shown with confirmed indicator)
- **No vehicle found** → "Scheduled 8:15 (unconfirmed)" (shown with warning indicator)

This tells the user whether the bus is actually running or if it's a ghost trip.

**Tier 3 — GPS-based ETA adjustment (v2 future):**
Use vehicle position + route shape + speed to estimate actual arrival time at stop, adjusting the scheduled time. Deferred to v2.

### 7.6 Profiles

- Save a configured journey (all legs) as a named profile
- Example: "Morning Commute", "Return Home"
- Quick-load from home screen
- Edit/delete profiles

### 7.7 Fallback Routes

- Up to 2 fallback routes per profile
- Each fallback is an independent journey configuration (alternate route)
- At-a-glance dashboard shows primary + fallbacks side by side
- Use case: "If MRT is packed, take LRT instead"

### 7.8 Dashboard (Home Screen)

- Select active profile
- Primary route: next departure + leave-by time, countdown
- Fallback routes: same info, shown below in compact view
- Auto-refreshes to keep times current
- Mobile-first design, glanceable

## 8. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | SvelteKit (fullstack) | SSR + API routes, minimal bundle, mobile-first |
| Database | SQLite | Single user, zero ops, file-based |
| GTFS Parsing | Node.js (in SvelteKit server routes) | Parse ZIP → extract schedule data |
| Hosting | Self-hosted (Tailscale) | Personal server, private access |
| Styling | TBD (Tailwind CSS recommended) | Utility-first, mobile responsive |

### 8.1 Architecture Principle

Keep business logic framework-agnostic for future migration:

```
src/lib/services/schedule.ts    ← pure logic, no SvelteKit dependency
src/lib/services/profile.ts     ← pure logic
src/lib/services/gtfs.ts        ← GTFS fetch/parse/cache
src/lib/db/                     ← DB access layer (SQLite now, Postgres later)
src/routes/api/                 ← thin SvelteKit handlers calling services
src/routes/                     ← Svelte pages/components
```

### 8.2 GTFS Data Pipeline

**Static (daily at 4am or on-demand):**
1. Fetch GTFS static ZIPs from API for all 4 feeds
2. Parse ZIP → extract `stops.txt`, `stop_times.txt`, `trips.txt`, `routes.txt`, `calendar.txt`, `frequencies.txt`
3. Normalize inconsistencies (BOM stripping, time format, missing agency_ids)
4. Store parsed data in SQLite for fast querying
5. Handle two scheduling models:
   - **Frequency-based** (rail, bus-kl): Generate departure times from template trip + frequency windows
   - **Schedule-based** (mrtfeeder, ktmb): Use exact times from stop_times directly

**Realtime (every 30s when dashboard is active):**
1. Poll GTFS Realtime vehicle position endpoints for active bus routes
2. Match `tripId` from realtime to scheduled trips in SQLite
3. Flag departures as "confirmed" (vehicle active) or "unconfirmed" (no vehicle found)
4. Serve confirmation status alongside scheduled departures

## 9. Out of Scope (v1)

- Route discovery / auto-planning (user configures legs manually)
- Smart multi-leg optimization (v2)
- GPS-based ETA adjustment / delay estimation (v2)
- Push notifications / "leave now" alerts
- Offline mode / PWA caching
- User auth / multi-user support
- BAS.MY services (outside KL)
- Monetization

## 10. Future Roadmap

| Version | Features |
|---------|----------|
| v1 | Core: manual legs, static schedules, profiles, fallbacks, dashboard, bus trip confirmation via realtime |
| v2 | Smart multi-leg optimization, GPS-based ETA adjustment using vehicle positions + route shapes |
| v3 | Trip updates API integration (when available), push notifications, PWA offline |
| v4 | Multi-user support, auth, Postgres migration, public deployment |

## 11. Success Criteria

- Personally achieve <2 min average wait time at stations
- Schedule data is accurate against real-world departures (validate manually)
- Dashboard loads in <1s on mobile
- Profile switching is instant

## 12. API Reference

- **Docs:** https://developer.data.gov.my
- **GTFS Static:** https://developer.data.gov.my/realtime-api/gtfs-static
- **GTFS Realtime:** https://developer.data.gov.my/realtime-api/gtfs-realtime
- **Base URL:** `https://api.data.gov.my`
- **Auth:** None required
- **Rate Limits:** Implemented but not publicly documented; refresh conservatively (daily)
