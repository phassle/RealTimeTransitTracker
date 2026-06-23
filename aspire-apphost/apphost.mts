// Aspire TypeScript AppHost
// For more information, see: https://aspire.dev

import { createBuilder } from './.aspire/modules/aspire.mjs';

const builder = await createBuilder();

// RealTimeTransitTracker is a client-only Vite SPA living at the repo root
// (one level up from this AppHost). Orchestrate its dev server so it shows up
// in the Aspire dashboard with logs + telemetry. Vite reads VITE_* keys from
// the repo-root .env itself, so no env wiring is needed here.
//
// withBrowserLogs() launches a tracked Chromium against the app and streams the
// browser's console + network activity into the dashboard — so everything that
// happens in the running SPA (logs, errors, fetch calls) is observable, not just
// the Vite dev-server stdout. (Aspire.Hosting.Browsers integration.)
await builder.addViteApp("transit", "..").withBrowserLogs();

await builder.build().run();