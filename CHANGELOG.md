# Changelog

## 3.1.0 — Docker Fixes, Searchable Dropdowns & View Switching

### 3.1.0
- Default port changed from 3000 to 3333 (Dockerfile, docker-compose, docs)
- Fixed Docker production crash: schema.sql now copied into production image
- Fixed DB path resolution using process.cwd() instead of __dirname (works in both dev and Docker)
- Fixed data directory permissions in Dockerfile (chmod 777)
- Alight stop selector in profile editor now uses custom Dropdown instead of native select
- Dropdown component: searchable filter mode with sticky search input and auto-focus
- Timezone selector in Settings replaced with searchable custom Dropdown
- Dropdown menu now scrollable (max-height: 240px) for long option lists
- Fixed profile/group switching on homepage — now uses URL query param (?view=) instead of cookies

### 3.1.1
- Backup & restore: download/upload profile backups as JSON from Settings
- Daily automatic backup option (runs at 4:00 AM, keeps last 7 days)
- Server-side backup list with per-file restore and manual "Backup now" button
- Pull-to-refresh on mobile: drag down from anywhere to refresh page data (GPU-accelerated, 60fps)
- Fixed departure selection resetting on every auto-refresh — now preserves user's choice

## 3.0.0 — Reliability, Animations & UX

### 3.0.0
- Timezone-aware scheduling: all date/time logic uses configured timezone instead of server local time
- Timezone selector in Settings page (defaults to server's timezone)
- Fixed infinite loop risk when GTFS frequency data has headway_secs=0
- Fixed crash on corrupt profile data (JSON.parse now has try/catch)
- Fixed optimizer buffer logic — was skipping valid early departures at transfers
- Fixed leaveByTime clamped to "00:00:00" for negative values — now returns null
- Fixed headsign derivation using unsorted stop list — now sorted by stop_sequence
- Fixed double invalidateAll() firing on page mount
- Fixed route stops endpoint returning ambiguous stop_sequence — now uses canonical trip
- Fetch timeouts: 10s for realtime API, 60s for GTFS import (prevents server hangs)
- Protobuf schema parsed once at module level instead of on every decode
- Input validation on all API endpoints: feedId, request body, settings keys, cookie values
- NaN guard on departure API numeric params
- GTFS import: concurrency lock prevents double-imports, optional secret header auth
- ProfileEditor: all fetch calls wrapped in try/catch with res.ok checks
- Secure cookie flags (httpOnly, sameSite) on activeView cookie
- Settings API restricted to allowlisted keys with value validators

### 3.0.1
- Countdown number pop animation on minute change (150ms scale)
- Urgency pulse on countdown when status is urgent or grace
- Cross-fade transition when switching between departures
- Vehicle approaching glow on ETA when bus is within 3 minutes
- NOW marker pulse animation on active trip timeline
- Loading spinners replace "Importing..."/"Saving..." text
- Departure selection background transition
- Step completion opacity adjusted to 0.6 for better readability
- All animations respect prefers-reduced-motion
- Skeleton/shimmer CSS utilities for future loading states

### 3.0.2
- Onboarding flow for new users (3-step guide, localStorage-persisted dismissal)
- Rail vs bus distinction: "Live", "Unconfirmed", or "Scheduled" badge on HeroCard
- Data freshness indicator ("Updated Xs ago") below hero card
- Timezone passed to active trip for correct time display

## 2.0.3
- Replace bottom tab bar with top-bar menu button + bottom sheet
- Hamburger menu on left, centered logo, clean top bar
- Theme toggle moved from top bar to Settings page (Dark/Light picker)
- Dashboard gets full vertical height (no more 72px wasted)
- Menu slides up with animation, closes on backdrop tap
- Active page indicated with accent dot
- Removed ThemeToggle component from top bar
- Page transitions: fade + slide via View Transitions API
- Menu sheet: Svelte fly/fade transitions for open/close, backdrop blur
- Drag handle on menu sheet
- Style guide updated with animation specs

## 2.0.2
- App icon in navbar beside zeroWait title
- Favicon and Apple touch icon set to app icon
- Icon moved to static/icon.png

## 2.0.0 — Dynamic Buffer & Profile Groups

### 2.0.0
- Replaced static buffer with dynamic max wait at station — system tells you to leave as late as possible within your wait tolerance
- Replaced fallback routes with profile groups — group alternative routes together, dashboard ranks by fastest arrival
- Merged departure list shows all routes in a group sorted by leave-by time
- Global default max wait setting (Settings page), per-stop override optional
- Removed grace period setting (now implicit)

### 1.5.0 — GPS-Based ETA & Trip Tracker

### 1.5.0
- GPS-based ETA estimation for bus departures using vehicle position, route shape geometry, and speed
- ETA delay adjusts leave-by time and journey timeline (late bus = more time, early bus = no change)
- Active trip tracker — start a trip, see live timeline with NOW marker, step completion, countdown
- Smart auto-refresh based on departure expiry times, pauses when tab hidden
- Bus license plate shown for confirmed departures

### 1.4.0
- Smart multi-leg journey optimizer — finds departure combos minimizing transfer wait time
- Transfer wait times annotated in journey timeline

### 1.3.0
- Estimated timeline with computed arrival time using GTFS ride durations
- Merged journey and timeline into single JourneyTimeline component

### 1.2.0
- Walk/Transit step model replacing the old Leg model
- Explicit journey steps: walk (description + duration) and transit (board at, alight at, direction auto-detected)
- Destination stop picker with auto direction detection
- Multi-leg journey details on dashboard

### 1.1.0
- Configurable grace period for past-leave-by departures
- Clickable departure list updates hero card
- Stop code and station name on hero card
- Stop code preference (stop_code over stop_id for MRT feeder)

### 1.1.1
- Pre-populate stop names when editing existing profiles
- Only show departures whose leave-by time is still reachable
- "Buffer at station" renamed from "Platform buffer"

## 1.0.0 — Initial Release

### 1.0.0
- GTFS data pipeline: fetch, parse, normalize, import for Prasarana Rail, RapidKL Bus, MRT Feeder Bus, KTMB
- Two departure engines: frequency-based (rail, bus-kl) and schedule-based (mrtfeeder, ktmb)
- Realtime bus trip confirmation via GTFS Realtime vehicle positions
- Dashboard with hero card, departure list, journey timeline
- Profile management with multi-leg journeys
- Dark mode default with light mode toggle
- Daily 4am auto-import scheduler
- SvelteKit fullstack, SQLite, adapter-node for self-hosting
- Style guide at /style-guide.html

### 1.0.1
- Auto-select first profile when no cookie set
- Hero card redesign: centered countdown, standardized spacing
- Uniform spacing between dashboard sections
- Custom dropdown component for selectors

## UX Polish (2.0.x)

### 2.0.1
- Hero card status based on both leave-by AND actual departure time
- Early bus ETA no longer causes false "missed" status
- Hero card countdown simplified to just "X min" with contextual badge
- Journey timeline: strict line-based layout, no text wrapping
- Minimal journey design: stop info is the highlight, action words removed
- Redundant duration text removed (time column provides this)
- Dots vertically centered with text in journey timeline
- Profiles page redesigned with group containers and inline add
- Custom dropdown in profile editor
- Server-side cookie for reliable view switching
