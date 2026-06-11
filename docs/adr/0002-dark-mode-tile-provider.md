# ADR 0002 — Dark mode swaps the tile provider to CartoDB Dark Matter

- **Status:** Accepted
- **Date:** 2026-06-09

## Context

Issue #35 asks for a dark/light **theme** toggle so the map is usable in low-light
environments. Two surfaces have to change with the theme: the app chrome (the
control panel and privacy notice, currently styled with hardcoded light colours)
and the **map tiles** themselves. A dark control panel floating over a bright
OpenStreetMap raster defeats the purpose.

OpenStreetMap's standard raster tiles are only served in the light style. There
is no official dark OSM raster. So a dark map requires one of:

1. A second raster tile provider that ships a dark basemap.
2. A CSS `filter: invert()/hue-rotate()` over the existing OSM tiles.
3. Self-hosted vector tiles with a dark style (e.g. MapLibre + a style JSON).

## Decision

- **Light theme** keeps the current OpenStreetMap raster tiles unchanged.
- **Dark theme** swaps the tile layer to **CartoDB Dark Matter**
  (`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`), which is
  free to use with attribution.
- The dark tile layer carries its own attribution:
  `© OpenStreetMap contributors © CARTO`. Light keeps the existing OSM +
  Trafiklab attribution.
- The theme is the user's own UI choice, persisted in **Essential storage**
  (see [CONTEXT.md](../../CONTEXT.md)) under a versioned key, mirroring the
  `useConsent` pattern. It does **not** introduce a Consent surface.
- Vehicle marker colours are unchanged — the white-bordered coloured markers are
  already high-contrast on both basemaps.

## Rationale

- **A real dark basemap beats inverting a light one.** CSS `invert()` over OSM
  produces muddy, hue-shifted labels and water — it looks broken, not dark.
  Dark Matter is a purpose-designed dark cartography.
- **Raster swap is a one-line layer change.** It fits the existing Leaflet raster
  pipeline (`L.tileLayer`) with no new build dependency. Vector tiles
  (option 3) would mean adding MapLibre and a style pipeline — disproportionate
  for a POC.
- **CARTO basemaps are free with attribution** for this scale of use, and are
  themselves built on OpenStreetMap data, so the underlying data licence story
  is unchanged.

## Relationship to ADR 0001 (does this trip the reversal trigger?)

**No.** [ADR 0001](0001-cookieless-no-consent-popup.md) keeps the app cookieless
and notice-only. Two clauses of its reversal trigger look relevant; neither fires:

- *"Non-essential client storage."* The theme preference is the record of the
  user's own UI choice — Essential storage by the CONTEXT.md definition, exactly
  like the privacy-notice dismissal. No new consent obligation.
- *"Embedded third-party content that sets cookies / shares user-identifying
  data."* Fetching a map tile from CARTO is the same category of request the app
  already makes to the OSM tile server: a raster image request that inherently
  exposes IP and viewport and sets no cookies. It does not broaden what the app
  discloses about the user beyond what tile-fetching already does.

The privacy notice's claims ("no tracking cookies, no analytics") remain true.

## Trade-offs

- **A second external tile dependency.** CARTO could rate-limit or change terms.
  Mitigation: light/OSM remains the default and is unaffected; a dark-tile
  failure degrades to missing tiles on a dark page, not a broken app.
- **Attribution must track the active layer.** Switching themes must switch the
  attribution string, or the map will show the wrong credit. This is a small but
  easy-to-forget correctness requirement, called out here so it is not dropped.

## Reversal trigger

Revisit this decision if any of the following becomes true:

- CARTO stops offering Dark Matter free at this usage tier, or requires an API
  key / account → re-evaluate options 2 and 3, or another free dark provider.
- The app moves to vector tiles for other reasons → fold the dark style into the
  vector style JSON and drop the raster swap.

## Consequences

- Theme state is owned in `App.jsx` and applied two ways: a `data-theme`
  attribute on the document root drives CSS-custom-property theming of the app
  chrome, and a `theme` prop drives the Leaflet tile-layer swap in the Map.
- The control-panel and privacy-notice stylesheets are refactored from hardcoded
  colours to CSS custom properties so the chrome can theme without per-rule
  edits.
- The initial theme is resolved synchronously before first paint (stored
  preference wins; otherwise `prefers-color-scheme`; otherwise light) to avoid a
  flash of the wrong theme.

## Related

- [CONTEXT.md](../../CONTEXT.md) — **Essential storage** now names "chosen theme" as an example.
- [ADR 0001](0001-cookieless-no-consent-popup.md) — cookieless Privacy Notice; this ADR confirms dark mode does not trip its reversal trigger.
- Issue `#35` — Dark mode support.
