# TripWire

PoC webpage tracker. A .NET background worker periodically fetches configured URLs,
extracts values via CSS selectors, evaluates rules against those values, and dispatches
actions (HTTP calls, logs) when rules fire. A React + Vite SPA provides the management
UI and a live event feed.

All state lives in three JSON files in [src/web-api/Data/](src/web-api/Data/) — no database.

## Stack

**Backend** — [src/web-api/](src/web-api/)
- .NET 8 / ASP.NET Core REST API + hosted background worker
- AngleSharp for HTML parsing + native CSS selector support
- System.Text.Json file storage (atomic writes, semaphore-serialized)
- Swagger UI at `/swagger`

**Frontend** — [src/web-ui/](src/web-ui/)
- React 19 + TypeScript
- Vite (dev proxy forwards `/api` → `http://localhost:5080`)
- React Router v7, TanStack Query v5
- Plain CSS with design-token custom properties (dark / light themes)

## Repository layout

```
TripWire/
├── TripWire.sln
├── src/
│   ├── web-api/            # .NET 8 backend (controllers, worker, JSON storage)
│   │   ├── Program.cs
│   │   ├── Data/           # config.json, actions.json, logs.json
│   │   ├── Models/, Storage/, Services/, Controllers/
│   │   └── README.md       # authoritative API reference
│   └── web-ui/             # React SPA — Vite app root
│       ├── index.html, vite.config.ts, package.json, tsconfig.*, eslint.config.js
│       ├── public/         # favicon.svg, icons.svg
│       ├── main.tsx, App.tsx, styles.css
│       ├── api.ts, types.ts
│       ├── components/     # Layout, PickerDialog, ThemeToggle, LogItem
│       └── pages/          # Dashboard, Trackers, TrackerEditor, Actions, ActionEditor, Logs
└── CLAUDE.md
```

## Run locally

You need both servers running in parallel for development.

**Backend** — from `src/web-api/`:

```bash
dotnet run            # API on http://0.0.0.0:5080, Swagger at /swagger
dotnet watch run      # hot reload
```

**Frontend** — from `src/web-ui/`:

```bash
npm install           # first time only
npm run dev           # Vite on http://localhost:5173, also exposed on LAN
npm run build         # tsc -b && vite build
npm run lint          # eslint
```

Both servers bind to all interfaces, so phones/tablets on the same LAN can hit the UI.
The Vite proxy forwards `/api/*` to `localhost:5080`, so LAN devices don't need to know
the API port.

There is no test suite.

## How it works

```
poll interval elapsed
  └── fetch URL (HttpClient, UA = TripWire/1.0, 30 s timeout)
        └── AngleSharp parse + QuerySelector per configured selector
              └── evaluate rules (edge-triggered for threshold / contains)
                    └── for each firing rule:
                          ├── append LogEntry (level EVT) to logs.json
                          └── look up triggerAction by id, execute
```

Rule types: `threshold` (numeric compare), `contains` (substring), `changed` (value differs
from last poll). `threshold` and `contains` fire only on the `false → true` edge;
`changed` fires every time the value differs from the previous observation.

Action types: `api-request` (HTTP call, optional headers/method), `log` (server log),
`script` (accepted but not executed in the PoC).

See [src/web-api/README.md](src/web-api/README.md) for the authoritative reference on
data shapes, endpoints, rule semantics, and storage behavior.

## Endpoints

All JSON, base path `/api`. Full reference in [src/web-api/README.md](src/web-api/README.md#endpoints).

- `GET|POST|PUT|DELETE /api/trackers[/{id}]`
- `GET|POST|PUT|DELETE /api/actions[/{id}]`
- `GET /api/logs?trackerId=&level=&limit=200` · `DELETE /api/logs`
- `GET /api/preview?url=…` — sanitized page proxy powering the visual element picker

## Gotchas

- Invalid CSS selectors don't throw in extract — they silently produce `null`, so a typo
  manifests as "rule never fires" rather than a visible error.
- Rule state (edge-trigger flags, previous values) lives only in memory. Restarting the
  API resets it, so every still-true condition fires once on the next tick.
- `logs.json` is ring-buffered at 10 000 entries.
- CORS is wide open (`AllowAnyOrigin/Method/Header`) — fine for local dev, tighten before
  any real deployment.
