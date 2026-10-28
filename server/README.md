# Truckflow Dashboard API

Read-only Node/Express API + WebSocket feed for a weighbridge/LAPI
supervision dashboard. Two interchangeable data sources, picked by one env
var — the rest of the API never changes:

- **`simulator`** (default) — an in-memory fake truck/weighing generator.
  Useful for local development or a demo with no database access.
- **`truckflow`** — reads live, real data from **TruckFlowDB**, the SQL
  Server database behind Precia Molen's Truckflow weighbridge suite.
  Strictly read-only: every query is a `SELECT`, nothing here ever writes to
  that database.

## Setup

```
npm install
cp .env.example .env
```

Edit `.env`:

- Leave `DATA_SOURCE=simulator` to run with fake data, no DB needed.
- Set `DATA_SOURCE=truckflow` plus `TRUCKFLOW_DB_HOST` / `TRUCKFLOW_DB_USER` /
  `TRUCKFLOW_DB_PASSWORD` to read real data. See `scripts/` below for how to
  get those credentials from a Truckflow installation.

```
npm run dev     # auto-restarts on file changes
npm start        # plain start
```

Listens on `http://localhost:3001` (override with `PORT`).

## Docker

The API itself runs in a container. `TruckFlowDB` stays on the Truckflow
machine's own SQL Server, exactly as installed by Précia Molen — it is
never containerized, just reached over the network like any other
database client.

```
cp .env.example .env     # fill in DATA_SOURCE / TRUCKFLOW_DB_* as above
docker compose up -d --build
docker compose logs -f   # watch it start
```

This builds the image from `Dockerfile` and starts it via
`docker-compose.yml`, reading config from `.env` and publishing port
`3001`. To stop it: `docker compose down`.

**`TRUCKFLOW_DB_HOST` and Docker:** the container needs to reach SQL
Server over the network — `localhost` means "this container," not the
Truckflow machine.

- Container running on a **different** machine than Truckflow (the
  normal case): set `TRUCKFLOW_DB_HOST` to the Truckflow machine's real
  LAN IP, same as the non-Docker setup.
- Container running **on the Truckflow machine itself**: set
  `TRUCKFLOW_DB_HOST=host.docker.internal` instead of `localhost`.

Rebuild after changing code: `docker compose up -d --build`. Just
changed `.env`? `docker compose up -d` (no `--build`) is enough —
restarts the container with the new values.

## API

| Endpoint | Description |
|---|---|
| `GET /api/state` | Current full dashboard snapshot (KPIs, on-site trucks, last plate read, weighbridge, journal, hourly chart) |
| `WS /ws` | Same snapshot, pushed live on every change |
| `GET /api/history?from&to&plaque` | Closed passages, filterable |
| `GET /api/history/export?from&to&plaque` | Same, as CSV (Excel-compatible, French locale) |
| `POST /api/camions/:plaque/sortie` | Force a truck's exit — **simulator mode only**, disabled under `truckflow` |
| `GET /api/truckflow/tickets?limit` | Raw ticket list from `WeighingReports` (requires `DATA_SOURCE=truckflow`) |
| `GET /api/truckflow/on-site` | Raw open weighings from `WeighingInProgresses` |
| `GET /api/truckflow/access-events?limit` | Raw LAPI/camera read log from `AccessHistories` |

## Connecting to a real Truckflow install

Truckflow stores everything in a SQL Server database (`TruckFlowDB`, usually
on instance `PMSQLSERVER`). To connect this API to it from another machine:

1. On the machine running Truckflow, run
   `scripts/windows-truckflow-setup-readonly-login.ps1` (PowerShell,
   `-ExecutionPolicy Bypass`). It creates a dedicated, read-only SQL login
   (never touches the app's own credentials) and reports whether the
   instance accepts remote TCP connections, plus this machine's IP.
2. If schema details ever need re-checking, `npm run truckflow:discover`
   (`scripts/truckflow-discover-schema.js`) dumps every table/column/row
   count to `truckflow-schema.json` (git-ignored).
3. Put the resulting host/instance/user/password into `.env`.

## Architecture notes

- `src/engine.js` — the simulator (state machine per truck: plate read →
  weighing → on-site → exit → closed), used when `DATA_SOURCE=simulator`.
- `src/truckflowEngine.js` — polls the real database on an interval and
  produces the exact same snapshot shape as the simulator, so API consumers
  never need to care which mode is active.
- `src/adapters/truckflowDb.js` / `truckflowAdapter.js` — the raw SQL Server
  connection and query layer.

Known limitations of `truckflow` mode (by design — nothing here is
fabricated to compensate): the weighbridge reading reflects the last value
written to the database, not a live sub-second ramp; plate-read direction
(entry/exit) is inferred from camera device/area naming since the schema has
no explicit column for it; OCR confidence isn't available in this schema.
