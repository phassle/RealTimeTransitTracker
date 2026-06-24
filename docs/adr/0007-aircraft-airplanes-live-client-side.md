# ADR 0007 — Aircraft layer fetches airplanes.live directly from the browser

- **Status:** Accepted
- **Date:** 2026-06-24

## Context

The aircraft/helicopter layer (PRD #165) adds live aircraft as Vehicles on the
map. That data has to come from a real-time ADS-B source, fetched **directly
from the browser** — the app is a client-only SPA with no backend and no proxy
([ADR 0001](0001-cookieless-no-consent-popup.md)). A source therefore has to be
reachable from the browser with no auth secret and with permissive CORS.

The candidates evaluated:

- **airplanes.live** — unauthenticated REST API, sends
  `access-control-allow-origin: *`, so it works directly from the browser with
  no proxy and no key. Point endpoint:
  `GET https://api.airplanes.live/v2/point/{lat}/{lon}/{radius_nm}` (radius
  ≤ 250 nm). Rate-limited to **1 request/second**. Terms are **Non-Commercial
  Use** with **no SLA**.
- **adsb.lol** — comparable data, but does **not** send the CORS header, so a
  browser fetch is blocked; it would require a proxy (a backend), which the
  architecture does not have.
- **OpenSky Network** — requires an **OAuth client secret**. A secret cannot
  live in a client SPA (it would be world-readable in the bundle), so it is
  incompatible with the no-backend constraint.

airplanes.live is the only candidate that fits the client-only, no-proxy
architecture.

## Decision

The aircraft layer fetches **airplanes.live** directly from the browser, with no
proxy and no auth, under its **Non-Commercial Use / no-SLA** terms. The endpoint
is declared in the single external-URL source of truth
(`src/config/endpoints.js`, `AIRPLANES_LIVE_BASE`).

airplanes.live is **disclosed in the Privacy Notice** alongside Trafiklab,
OpenStreetMap, and the webcam sources — named, linked, and annotated that the
data is fetched **only while zoomed in**. **No Consent surface is introduced**:
this is the same trust category as the existing third-party fetches (Trafiklab
API, OSM/CARTO tiles, hotlinked webcam stills) — the network request inherently
exposes the user's IP to the source, but nothing is stored on the device and no
source-controlled script runs. ADR 0001's cookieless posture is therefore
**unaffected**.

## Rationale

- **Fits the architecture.** Unauthenticated + CORS-open is the only shape a
  browser can fetch without a proxy; the alternatives need a backend (adsb.lol)
  or a secret that cannot ship in client code (OpenSky).
- **Keeps ADR 0001 standing.** No new client storage, no embedded
  source-controlled script, no identifying data shared beyond what the request
  inherently exposes — none of ADR 0001's reversal triggers fire, so the
  Privacy Notice (not a Consent gate) remains the correct surface.
- **Proportionate to a private demo.** The Non-Commercial-Use terms and absence
  of an SLA are acceptable because this is a **private, non-monetized demo**.
  Aircraft are non-essential overlay data: a fetch failure simply means no
  aircraft show, with no error surfaced.

## Trade-offs

- **Non-Commercial Use only.** If the project is ever monetized or shipped
  commercially, this source's terms no longer permit it and the source must be
  swapped (see reversal trigger).
- **No SLA.** airplanes.live may be slow or unavailable; the layer tolerates
  this silently (aircraft are an overlay, not core transit data).
- **1 req/s budget.** The aircraft poll fetches only when zoomed in (≈ zoom 8+)
  and derives a viewport-capped radius (≤ 250 nm) to stay within budget.

## Reversal trigger

This decision is revisited if **any** of the following holds:

- The project becomes **commercial / monetized** — Non-Commercial Use no longer
  applies and the source must be replaced with a commercially-licensed one.
- A future aircraft feature requires **auth, a secret, or any persisted or
  identifying data sent to the source** beyond the coordinates of a public
  ADS-B query — that would trip ADR 0001's reversal trigger and oblige the full
  Consent surface ADR 0001 prescribes.

## Related

- [ADR 0001](0001-cookieless-no-consent-popup.md) — cookieless app, Privacy
  Notice not Consent gate; defines the reversal trigger this ADR stays inside.
- [ADR 0004](0004-webcam-layer-static-images-no-embeds.md) — third-party-source
  precedent (hotlinked stills in the same trust category).
- [CONTEXT.md](../../CONTEXT.md) — **Aircraft** / **Vehicle**, **Transport
  modes** (mode set decoupled from GTFS), and the **Privacy Notice** glossary.
- Parent PRD: `#165` — Aircraft/helicopter layer + click-to-follow vehicles.
