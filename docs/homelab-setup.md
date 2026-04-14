# Homelab Setup Guide

Host zeroWait on your own server using Docker.

## Prerequisites

- Docker and Docker Compose installed
- Git (to clone the repo)

## Quick Start

```bash
git clone <your-repo-url> zerowait
cd zerowait
docker compose up -d --build
```

The app is now running at `http://<your-server-ip>:3000`.

## First Run

1. Open the app in your browser
2. Go to **Settings > Refresh Schedule Data** to import GTFS timetables
3. Create your first commute profile

After the initial import, schedules refresh automatically every day at 4:00 AM MYT.

## Data Persistence

The SQLite database is stored at `./data/zerowait.db` on your host machine via a Docker volume mount. Your profiles, settings, and schedule data survive container rebuilds.

To back up your data:

```bash
cp data/zerowait.db data/zerowait.db.bak
```

## Configuration

Environment variables can be set in `docker-compose.yml` under `environment`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `IMPORT_SECRET` | _(none)_ | If set, the GTFS import API requires this value in the `x-import-secret` header |

## Updating

```bash
git pull
docker compose up -d --build
```

Your data in `./data/` is preserved across rebuilds.

## Exposing via Tailscale

If your homelab runs Tailscale, the app is accessible at `http://<tailscale-hostname>:3000` from any device on your tailnet. No reverse proxy or port forwarding needed.

## Exposing via Reverse Proxy (Optional)

If you want HTTPS or a custom domain, put a reverse proxy in front of the app. Example with Caddy:

```
zerowait.yourdomain.com {
    reverse_proxy localhost:3000
}
```

## Troubleshooting

**Check logs:**

```bash
docker compose logs -f zerowait
```

**Rebuild from scratch:**

```bash
docker compose down
docker compose up -d --build
```

**Reset all data:**

```bash
docker compose down
rm data/zerowait.db
docker compose up -d
```
