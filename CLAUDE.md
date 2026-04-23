# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

TripWire is a PoC webpage tracker. A .NET background worker periodically fetches configured URLs, extracts values via CSS selectors with AngleSharp, evaluates rules (threshold / contains / changed), and dispatches actions (webhook, api-request, log, script) when rules fire. A React + Vite SPA provides the management UI and a live event feed.

**All state is three JSON files in [src/web-api/Data/](src/web-api/Data/) — no database.** `config.json` holds trackers + rules, `actions.json` holds action definitions, `logs.json` holds the event log (ring-buffered at 10,000 entries).

[src/web-api/README.md](src/web-api/README.md) is the authoritative reference for data shapes, endpoints, rule semantics, and storage behavior — consult it before changing anything in those areas. The root [README.md](README.md) is unchanged Vite template boilerplate; ignore it.

## Repository layout

- Workspace root *is* the Vite app root — `index.html`, `package.json`, `vite.config.ts`, `tsconfig.*` all live here.
- [src/web-ui/](src/web-ui/) — React 19 + TypeScript frontend (Vite, React Router v7, TanStack Query v5, plain CSS with custom-property design tokens in [styles.css](src/web-ui/styles.css)).
- [src/web-api/](src/web-api/) — .NET 8 / ASP.NET Core backend. DI, CORS, Swagger, and worker registration all wired in [Program.cs](src/web-api/Program.cs).
- [TripWire.sln](TripWire.sln) — solution file for the backend.

## Commands

### Frontend (run from repo root)

```bash
npm install           # first time only
npm run dev           # Vite dev server on :5173, exposed on LAN (host: true)
npm run build         # tsc -b && vite build
npm run lint          # eslint
npm run preview       # preview production build
```

### Backend (run from `src/web-api/`)

```bash
dotnet run            # API on http://0.0.0.0:5080, Swagger at /swagger
dotnet build
dotnet watch run      # hot reload
```

**You need both running together** for local development: `npm run dev` in one terminal, `dotnet run` in another. Vite's dev proxy forwards `/api/*` → `http://localhost:5080` ([vite.config.ts](vite.config.ts)).

There is no test suite.

## Architecture — the parts that span multiple files

### The poll → extract → evaluate → act pipeline

Orchestrated by [TrackerWorker.cs](src/web-api/Services/TrackerWorker.cs) (a `BackgroundService`), which ticks every 1s. Each tick: read [config.json](src/web-api/Data/config.json) via `JsonStore`, for each tracker whose `intervalSeconds` has elapsed since last poll, kick off `ProcessTrackerAsync` on a fire-and-forget `Task.Run`.

- **Per-tracker in-flight guard**: `_inFlight` dictionary prevents overlapping polls on the same tracker if fetch/parse runs long. If a tick finds a tracker still processing, it skips that tracker entirely (not queued).
- **Fetch**: shared `HttpClient` via `IHttpClientFactory`, 30 s timeout, UA `TripWire/1.0`.
- **Extract**: [ContentAnalyzer.Extract](src/web-api/Services/ContentAnalyzer.cs) runs `QuerySelector` per configured selector. Invalid CSS → value is null (not an exception).
- **Evaluate**: `ContentAnalyzer.Evaluate` walks each rule's `selectorNames` in order and fires on the **first** selector whose value satisfies the condition. The firing selector name ends up in `LogEntry.context.selector`.
- **Dispatch**: if a rule has `triggerAction`, look up the action by id in `actions.json` and call [ActionExecutor.ExecuteAsync](src/web-api/Services/ActionExecutor.cs). Action HTTP timeout is 15 s.
- **Failures** are logged to `logs.json` with level `ERR` (not thrown).

### Edge-triggered rule state lives only in memory

[ContentAnalyzer](src/web-api/Services/ContentAnalyzer.cs) holds two `ConcurrentDictionary` fields:
- `_lastValues` keyed `"trackerId|selectorName"` — previous observed value (needed by `changed` and for the `previousValue` log field).
- `_lastTriggered` keyed `"trackerId|ruleIndex"` — whether the rule matched on the previous tick.

`threshold` and `contains` emit only on the `false → true` transition (edge-triggered). `changed` emits every time the value differs from the prior observation — the first observation never fires `changed`.

**Consequences when editing**: restarting the API resets all edge state, so every still-true condition will fire once on the next tick. Rule *indices* key this state — reordering rules changes which edge-trigger history applies to which rule. Don't "optimize" by collapsing these dictionaries into a database — `ContentAnalyzer` is a singleton exactly because this state must be shared across polls.

### Storage semantics: [JsonStore<T>](src/web-api/Storage/JsonStore.cs)

Generic file-backed store shared by API controllers and the worker. Uses a `SemaphoreSlim` to serialize reads/writes. Writes are atomic: serialize to `*.tmp`, delete original, rename. This is why the three stores (`TrackerFile`, `ActionFile`, `LogFile`) are registered as singletons in `Program.cs` — the semaphore only protects concurrent access if everyone shares one instance. When adding endpoints that mutate files, use `UpdateAsync(file => ...)` rather than `ReadAsync` + `WriteAsync` to avoid the read-modify-write race.

### Frontend data flow

- [api.ts](src/web-ui/api.ts) is a thin typed fetch wrapper with one object per resource (`trackers`, `actions`, `logs`). All endpoints go through `/api` so the Vite proxy forwards them in dev and a reverse-proxy setup can forward them in production.
- [types.ts](src/web-ui/types.ts) mirrors the C# models. Keep these in sync by hand when touching [src/web-api/Models/](src/web-api/Models/).
- TanStack Query is the source of truth for server state — `Dashboard`, `Logs`, and `Layout` use `refetchInterval` to keep the UI live against the polling worker. Don't add manual polling loops.
- [Layout.tsx](src/web-ui/components/Layout.tsx) is the shell (sidebar + topbar). Route → title/breadcrumb/action mapping is all in the `buildHeader` function at the bottom of that file.
- [styles.css](src/web-ui/styles.css) is one file with CSS custom-property tokens under `:root[data-theme='dark']` and `:root[data-theme='light']`. Theme is toggled on `<html>` via [ThemeToggle.tsx](src/web-ui/components/ThemeToggle.tsx) and persisted to localStorage. Prefer editing tokens over hardcoding colors in component styles.

### The visual element picker

[PickerDialog.tsx](src/web-ui/components/PickerDialog.tsx) loads the target page through [PreviewController](src/web-api/Controllers/PreviewController.cs) (`/api/preview`) rather than directly in an iframe. The backend rewrites/sanitizes the page and injects a picker script that `postMessage`s selector picks back to the parent. This exists because loading third-party pages directly into an iframe is blocked by `X-Frame-Options` / `frame-ancestors` on most sites — editing the picker flow means touching both sides.

## Network binding

Both dev servers listen on all interfaces so LAN devices (phones etc.) can reach the UI:

- Vite: `server.host: true` + `strictPort: true` in [vite.config.ts](vite.config.ts). Vite prints the LAN URLs on startup.
- API: `applicationUrl: http://0.0.0.0:5080` in [launchSettings.json](src/web-api/Properties/launchSettings.json).

Other devices hit the Vite network URL; the proxy forwards `/api` to `localhost:5080` on the dev machine, so they don't need to know the API port. Windows Firewall will prompt the first time on both `node.exe` and `dotnet.exe`.

## Gotchas worth knowing

- **Invalid CSS selectors don't throw** in `Extract`; they silently produce `null`. A rule against a null value never matches, so a typo in a selector manifests as "rule never fires" rather than a visible error.
- **`script` action type** is accepted by the schema but intentionally not executed in the PoC. Don't add execution without discussing scope.
- **`threshold` number parsing** strips currency/whitespace and handles both `1,234.56` (EN) and `1.234,56` (DE). Added surprises here will silently change which values match.
- **CORS is wide-open** (`AllowAnyOrigin/Method/Header`) — fine for local dev, needs tightening before any real deployment.
- **`logs.json` is ring-buffered at 10,000 entries** in [TrackerWorker.AppendLogAsync](src/web-api/Services/TrackerWorker.cs). UI components that fetch logs (`limit=200`) assume newest-first ordering from the controller.
