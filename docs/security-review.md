# Security review (mandatory before every PR)

Run this analysis before opening a PR. The [create-pr](../.agents/skills/create-pr/SKILL.md) skill runs it as a gate.

- **Secrets in build output**: `GTFS_REGIONAL_API_KEY` must never reach the client bundle (build-time only). `VITE_TRAFIKLAB_API_KEY` is intentionally public and client-bundled — that is expected, not a finding. Grep `dist/` for any non-`VITE_` secret.
- **XSS vectors**: every popup / `innerHTML` path must HTML-escape feed data first (`Map.jsx:26-32`). No raw feed strings into the DOM.
- **Unsanitized feed data**: treat all GTFS-RT fields as untrusted input.
- **`npm audit`**: review and address high/critical advisories.
- **CSP / headers**: confirm no regression in the static-hosting headers.
- **Build hygiene**: sourcemaps stay off (`vite.config.js:9-11`).

Issues / PRDs live on GitHub — see [agents/issue-tracker.md](agents/issue-tracker.md).
