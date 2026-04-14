# zeroWait — Project Instructions

## Changelog

**Every commit must update `CHANGELOG.md`** at the project root.

### Versioning scheme (semver-like, 3 levels)

| Level | Format | When to bump | Example |
|-------|--------|-------------|---------|
| Major | `X.0.0` | New major feature, breaking changes, significant model/architecture changes | 1.0.0 → 2.0.0 (profile groups replaced fallbacks) |
| Minor | `X.Y.0` | Smaller but impactful features, new components, new API endpoints | 1.0.0 → 1.1.0 (grace period, clickable departures) |
| Patch | `X.Y.Z` | Bug fixes, tweaks, UI polish, wording changes, spacing fixes | 1.1.0 → 1.1.1 (fix stop name display) |

### Rules
- Add entries under the current version section at the top of the changelog
- If the change warrants a version bump, create a new version header
- Multiple small fixes in one session can share a patch version
- Each entry is a single line starting with `-`
- Keep entries concise — what changed, not how

### Format
```markdown
## X.Y.0 — Short Description

### X.Y.0
- Feature or change description

### X.Y.1
- Fix or tweak description
```

## Tech Stack
- SvelteKit (fullstack, Svelte 5 runes mode)
- SQLite via better-sqlite3
- TypeScript
- adapter-node (self-hosted via Tailscale)
- No Tailwind — vanilla CSS with design tokens from style guide

## Key Files
- `docs/style-guide.html` — design tokens, component reference (source of truth)
- `static/style-guide.html` — served copy (keep in sync with docs/)
- `docs/prd-zerowait.md` — product requirements
- `docs/gtfs-data-analysis.md` — GTFS data shape analysis
- `src/lib/types.ts` — all shared types
- `src/lib/db/schema.sql` — SQLite schema
- `src/lib/db/connection.ts` — DB singleton with migrations
- `src/lib/services/` — business logic (framework-agnostic)
- `src/lib/components/` — Svelte UI components
- `src/routes/api/` — REST API endpoints
- `src/app.css` — global CSS design tokens

## Architecture
- Business logic in `src/lib/services/` — no SvelteKit dependency
- DB layer in `src/lib/db/` — SQLite now, designed for Postgres migration later
- Thin SvelteKit handlers in `src/routes/api/`
- All CSS uses custom properties from `src/app.css`
- Components use scoped `<style>` blocks referencing the tokens

## Data Model
- **Profile**: named journey with Walk/Transit steps
- **ProfileGroup**: collection of profiles sharing same origin/destination
- **Step**: either WalkStep (description + minutes) or TransitStep (from/to stop, route, maxWait)
- **Departure**: computed from GTFS schedules, includes realtime ETA when available
- **ActiveTrip**: localStorage-persisted trip in progress

## GTFS Data
- 4 feeds: rapid-rail-kl, rapid-bus-kl, rapid-bus-mrtfeeder, ktmb
- Two scheduling models: frequency-based (rail, bus-kl) and schedule-based (mrtfeeder, ktmb)
- Realtime: vehicle positions for buses only (no rail realtime)
- Daily auto-import at 4am MYT
- API: api.data.gov.my (no auth required)

## Style Guide Rules
- Dark mode default, system-adaptive toggle
- All spacing via `gap: var(--space-xl)` for section rhythm
- Stop codes color-coded with route color (text, not background)
- DM Sans for UI, DM Mono for times/codes
- Mobile-first, max-width 420px
- No text wrapping in journey timeline — truncate with ellipsis

## Validation
```bash
npx svelte-kit sync && npx tsc --noEmit  # type-check
npm run build                              # production build
```
