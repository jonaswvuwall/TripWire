# TripWire Web API

PoC backend for a webpage tracker. Periodically fetches configured URLs, extracts values
via CSS selectors, evaluates rules against those values, and dispatches actions
(webhooks, HTTP calls, logs) when rules fire. All state lives in three JSON files in
`Data/` — no database.

## Stack

- **.NET 8 / ASP.NET Core** — REST API + hosted background worker
- **AngleSharp** — HTML parsing with native CSS selector support
- **System.Text.Json** — file storage (camelCase, indented)
- **Swagger UI** — interactive docs at `/swagger`

> AngleSharp was chosen over HtmlAgilityPack because it supports CSS selectors natively,
> so no second library (Fizzler) is needed.

## Run

From `src/web-api/`:

```bash
dotnet run
```

Defaults to `http://localhost:5080`. Open `/swagger` for interactive docs.
The background worker starts automatically and polls every configured tracker on its
own interval.

## Backend project layout

```
src/web-api/
├── Program.cs                      # DI, CORS, Swagger, worker registration
├── appsettings.json
├── TripWire.WebApi.csproj
├── Data/                           # JSON storage (created on first run if missing)
│   ├── config.json                 # trackers + rules
│   ├── actions.json                # action definitions
│   └── logs.json                   # event log (ring-buffered at 10k entries)
├── Models/
│   ├── Tracker.cs
│   ├── Selector.cs
│   ├── Rule.cs
│   ├── TrackerAction.cs
│   └── LogEntry.cs
├── Storage/
│   └── JsonStore.cs                # generic file-backed, lock-guarded store
├── Services/
│   ├── ContentAnalyzer.cs          # extracts values, evaluates rules (edge-triggered)
│   ├── ActionExecutor.cs           # dispatches webhook / api-request / log / script
│   └── TrackerWorker.cs            # BackgroundService loop
└── Controllers/
    ├── TrackersController.cs
    ├── ActionsController.cs
    ├── LogsController.cs
    └── PreviewController.cs        # /api/preview — inspector-style page proxy
```

## Frontend

Lives in the sibling [`../web-ui/`](../web-ui/) folder — a Vite + React 19 + TypeScript
single-page app that consumes the API.

**Stack**

- **React 19 + TypeScript** — UI runtime
- **Vite** — dev server + bundler (dev proxy forwards `/api` → `http://localhost:5080`)
- **React Router v7** — client-side routing
- **TanStack Query v5** — data fetching, caching, auto-refetch for the live log/event views
- **lucide-react** — iconography
- Plain CSS with custom-property tokens — dark / light themes, no framework

**Run** from the repository root:

```bash
npm install   # first time only
npm run dev
```

Opens on `http://localhost:5173`. Start the backend (`dotnet run` in `src/web-api/`)
separately so the Vite proxy has something to forward to.

**Folder layout**

```
src/web-ui/
├── main.tsx                        # React + Router + QueryClient providers
├── App.tsx                         # route table
├── styles.css                      # design tokens + components (dark/light themes)
├── api.ts                          # typed fetch client for /api
├── types.ts                        # TS models mirroring the C# API
├── components/
│   ├── Layout.tsx                  # app shell: sidebar, topbar, live worker indicator
│   ├── LogItem.tsx                 # single event row with level + context chips
│   ├── PickerDialog.tsx            # visual element picker modal (iframe + postMessage)
│   └── ThemeToggle.tsx             # sun/moon toggle, persists to localStorage
└── pages/
    ├── Dashboard.tsx               # stat cards + recent events + tracker activity
    ├── Trackers.tsx                # list view
    ├── TrackerEditor.tsx           # form: general + selectors + rules (with picker)
    ├── Actions.tsx                 # list view
    ├── ActionEditor.tsx            # form: type + HTTP + headers
    └── Logs.tsx                    # live-refreshing event feed with filters + search
```

The entry points `index.html`, `vite.config.ts`, and `package.json` live at the repo root
since Vite treats the workspace root as the app root.

## Endpoints

All JSON. Base path: `/api`.

### Trackers — `/api/trackers`

| Method | Path                   | Description                 |
| ------ | ---------------------- | --------------------------- |
| GET    | `/api/trackers`        | List all trackers           |
| GET    | `/api/trackers/{id}`   | Get one tracker             |
| POST   | `/api/trackers`        | Create (409 if id taken)    |
| PUT    | `/api/trackers/{id}`   | Replace (404 if missing)    |
| DELETE | `/api/trackers/{id}`   | Delete                      |

### Actions — `/api/actions`

Same CRUD shape as trackers.

### Logs — `/api/logs`

| Method | Path                                                       | Description                          |
| ------ | ---------------------------------------------------------- | ------------------------------------ |
| GET    | `/api/logs?trackerId=&level=&limit=200`                    | List (newest first, all params opt.) |
| DELETE | `/api/logs`                                                | Clear the log                        |

## Data shapes

### Tracker

```json
{
  "id": "product-price-tracker",
  "name": "Produktpreis überwachen",
  "url": "https://example.com/product123",
  "intervalSeconds": 60,
  "selectors": [
    { "name": "price", "element": ".product-price" }
  ],
  "rules": [
    {
      "selectorNames": ["price"],
      "type": "threshold",
      "operator": ">",
      "value": 90,
      "triggerAction": "action-send-webhook",
      "message": "Price above threshold"
    }
  ]
}
```

### Action

```json
{
  "id": "action-send-webhook",
  "type": "webhook",
  "method": "POST",
  "url": "https://example.com/webhook",
  "headers": { "X-Api-Key": "secret" }
}
```

`type` is one of `webhook`, `api-request`, `log`, `script`.
`script` is accepted by the schema but not executed in the PoC.

### Log entry

```json
{
  "timestamp": "2026-04-21T10:15:00Z",
  "level": "EVT",
  "message": "Price above threshold",
  "context": {
    "trackerId": "product-price-tracker",
    "selector": "price",
    "ruleType": "threshold",
    "previousValue": "95",
    "currentValue": "105",
    "triggeredAction": "action-send-webhook"
  }
}
```

## Rule types

| type        | fires when                                                             | required fields        |
| ----------- | ---------------------------------------------------------------------- | ---------------------- |
| `threshold` | numeric value satisfies `operator value` (`>`, `<`, `>=`, `<=`, `==`, `!=`) | `operator`, `value`    |
| `contains`  | extracted text contains `value` (case-insensitive)                     | `value` (string)       |
| `changed`   | extracted text differs from the previous poll                          | —                      |

**Edge-triggered.** `threshold` and `contains` fire once on the `false → true`
transition and stay silent while the condition remains true. `changed` fires
every time the value differs from the previous one (its nature is already
edge-like). The first observation of a selector never triggers `changed`.

### Selector matching

A rule lists one or more `selectorNames`. The analyzer evaluates the rule
against each named selector in order and fires on the **first** selector whose
value satisfies the condition. The firing selector name is recorded in
`context.selector`.

### Number parsing (threshold)

The analyzer strips non-numeric noise (currency symbols, whitespace) before
comparison and handles both `1,234.56` (EN) and `1.234,56` (DE) decimal styles.

## Execution flow

```
poll interval elapsed
  └── fetch URL (HttpClient, UA = TripWire/1.0)
        └── AngleSharp parse + QuerySelector per selector
              └── evaluate rules (edge-triggered)
                    └── for each firing rule:
                          ├── append LogEntry (level EVT)
                          └── look up triggerAction by id, execute
```

Per-tracker:
- A tracker is skipped on a tick if the previous poll is still in flight.
- Fetch timeout: 30 s. Action HTTP timeout: 15 s.
- Errors are logged to `logs.json` with level `ERR`.

## Storage semantics

- JSON files live in `src/web-api/Data/` (content-root relative).
- `JsonStore<T>` serializes reads and writes via a `SemaphoreSlim` — safe for
  concurrent API + worker access.
- Writes are atomic: write to `*.tmp`, delete original, rename.
- `logs.json` is capped at 10 000 entries (oldest dropped).

## CORS

The default policy allows any origin / method / header, so a local React dev
server (e.g. Vite on `5173`) can call the API without configuration.
