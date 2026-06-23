---
name: observe-running-app
description: See what actually happens inside the running SPA — browser console, network (GTFS-RT fetches), and JS errors — via the optional Aspire AppHost. Use when an agent needs to observe runtime behavior of the app (not just Vite stdout), debug live polling, or confirm a change works in the real browser.
---

# Observe the running app (Aspire AppHost)

Optional dev-orchestration layer. **No backend** — the app stays client-only (ADR 0001). The AppHost just runs the Vite dev server and gives a dashboard + telemetry. TypeScript AppHost (keeps the repo all-JS/TS). Requires the Aspire CLI (`aspire --version`) + dotnet.

## Files

- AppHost: `aspire-apphost/apphost.mts` → `builder.addViteApp("transit", "..").withBrowserLogs()`
- Config: `aspire.config.json` (SDK version, AppHost path, `Aspire.Hosting.JavaScript` + `Aspire.Hosting.Browsers` packages)
- `.aspire/` + `node_modules/` are gitignored.

## Run

```bash
aspire run            # repo root → dashboard (https://localhost:17239) + the Vite app
npm run aspire:start  # same, via passthrough script
aspire stop           # stop the AppHost
```

## See browser console + network

`withBrowserLogs()` (integration `Aspire.Hosting.Browsers`) launches a **tracked Chrome** against the app and streams the browser's console + network (and JS errors) to the dashboard — this is how an agent sees what happens *in the SPA*. The session is **start-on-demand**; after each `aspire run`, trigger it once:

```bash
aspire resource transit-browser-logs open-tracked-browser   # launch tracked browser
aspire logs transit-browser-logs --follow                   # console + network (GTFS-RT fetches: status/ms/bytes)
```

## Notes

- Resource names carry a unique suffix (`transit-<id>`) — find them with `aspire ps --include-hidden --format Json` or `aspire describe --include-hidden`.
- `aspire otel logs|traces` for structured OpenTelemetry.
- To regen the TypeScript bindings after adding an integration: `aspire add <name>` → `aspire restore`.
- The Trafiklab key appears in captured fetch URLs but is already client-bundled (`VITE_` prefix) and logs are local — no new exposure.
