# zeroWait

**Stop waiting at stations. Start arriving on time.**

zeroWait tells you exactly when to leave so you arrive at your Malaysian transit stop just as your bus or train does. No more guessing, no more standing on platforms for 10 minutes, no more rushing because you left too late.

## The Problem

Every commuter knows the drill: leave too early and you waste time standing around; leave too late and you watch your bus pull away. Existing apps tell you when the next departure is, but not when *you* should walk out the door.

## How zeroWait Works

```
Your leave time = Next departure - Walk time to stop - Wait tolerance
```

You define your journey once (walk 8 min to the station, take the MRT, transfer to a bus, walk 3 min to work), and zeroWait gives you a single answer: **leave at 7:39 AM**.

- **Multi-leg journeys** — chain walks, trains, and buses into a single commute profile
- **Smart optimizer** — finds the best departure combination across transfers to minimize waiting
- **Live tracking** — start a trip and follow along with a real-time step-by-step timeline
- **GPS-based ETA** — bus positions are tracked via GTFS Realtime to adjust for delays
- **Multiple routes** — group alternative routes together; the dashboard ranks them by fastest arrival

## Transit Systems Supported

| System | Type | Live Tracking |
|--------|------|:---:|
| MRT Kajang & Putrajaya Lines | Rail | Schedule |
| LRT Kelana Jaya & Ampang Lines | Rail | Schedule |
| KL Monorail | Rail | Schedule |
| KTMB Komuter | Rail | Schedule |
| RapidKL Bus | Bus | Live GPS |
| MRT Feeder Bus | Bus | Schedule |

Data sourced from [Malaysia's Official Open API](https://developer.data.gov.my) (no auth required). Schedules refresh automatically every day at 4:00 AM.

## Quick Start (Docker)

```bash
git clone https://github.com/kaizen-hryy/zeroWait.git
cd zeroWait
docker compose up -d --build
```

Open `http://localhost:3333`, go to **Settings > Refresh Schedule Data** to import timetables, then create your first commute profile.

See [docs/homelab-setup.md](docs/homelab-setup.md) for full deployment details including Tailscale, reverse proxy, and configuration options.

## Key Features

### Dashboard
A single glanceable screen with everything you need: a countdown to when you should leave, the next departures across all your routes, and a detailed journey timeline. Auto-refreshes based on departure times, pauses when the tab is hidden.

### Commute Profiles
Define your journey as a series of steps — walk to the station, board a train, transfer to a bus, walk to work. Save it as a profile and load it with one tap. Group alternative routes together to always see the fastest option.

### Trip Tracker
Tap "Start this trip" and get a live timeline showing where you should be at each step. A NOW marker tracks your progress. Completed steps fade out so you can focus on what's next.

### Backup & Restore
Download your profiles and settings as a JSON file anytime. Enable daily automatic backups in Settings — runs at 4 AM, keeps the last 7 days, one-click restore.

## Tech Stack

- **SvelteKit** (fullstack, Svelte 5 runes mode)
- **SQLite** via better-sqlite3
- **TypeScript**
- **Docker** with adapter-node for self-hosting
- Vanilla CSS with design tokens (no Tailwind)
- Mobile-first, dark mode default

## Development

```bash
npm install
npm run dev
```

Type-check and build:

```bash
npx svelte-kit sync && npx tsc --noEmit
npm run build
```

## License

Private project. Not open-sourced.
