# ADR 0004 — Webcam layer hotlinks static images; never embeds third-party players

- **Status:** Accepted
- **Date:** 2026-06-11

## Context

The webcam layer (issue #65) shows Sweden's openly published webcams on the transit map. Several sources offer richer media than stills: Windy provides an embeddable player, and a number of cameras (Arvidsjaur, the Stork Project, Valsjöbyn, several ski cameras) are live streams.

Embedding a third-party player or stream iframe sets third-party cookies and fingerprintable storage on the user's device. That is verbatim one of the reversal triggers in [ADR 0001](0001-cookieless-no-consent-popup.md): introducing such content reverses the cookieless decision and obliges the app to ship a real two-category opt-in Consent surface.

A hotlinked static `<img>` is different in kind: the image request exposes the user's IP to the source exactly as OSM tile loading already does, and an `<img>` element does not execute source-controlled script or set storage beyond ordinary HTTP caching.

## Decision

The webcam layer renders camera media **only** as hotlinked static `<img>` elements fetched directly from the source. It never embeds third-party players, stream iframes, or source-controlled script.

Cameras whose only media is a stream or an embed-only player are included as **`linkout`** cameras: the popup shows name, location, attribution, and a link to the source page, with no inline media. This is recorded as the explicit `media: image | linkout` field in the camera data model (see the Webcam-layer glossary in [CONTEXT.md](../../CONTEXT.md)).

If Windy's API terms do not permit static preview images outside their player, Windy cameras degrade to `linkout` rather than being embedded.

## Rationale

- **Keeps ADR 0001 standing.** The cookieless Privacy-Notice posture survives intact; no Consent surface is needed because no conditional processing is introduced.
- **Proportionate.** Building a full Consent gate to inline a handful of live streams would cost more than the streams are worth; a link out delivers the same content one click away.
- **Same trust category as existing behaviour.** Hotlinked stills sit in the bucket the app already occupies with OSM tiles and Trafiklab API calls: IP exposure inherent to the network request, nothing stored, nothing executed.

## Trade-offs

- Live-stream cameras are second-class on this map: a link, not an inline view. Users wanting the stream leave the app.
- Windy coverage may be metadata-only if their terms block standalone previews.
- Hotlinking shifts image bandwidth to the sources; mitigated by manual-only refresh (no auto-refresh polling of images) and attribution/links in every popup so traffic and credit flow back to the source.

## Reversal trigger

This decision reverses only together with ADR 0001's reversal: if the project deliberately accepts non-essential third-party processing and ships the full Consent surface ADR 0001 prescribes, inline embeds may then be offered **behind that consent**, never before it.

## Related

- [ADR 0001](0001-cookieless-no-consent-popup.md) — cookieless app, Privacy Notice not Consent gate; defines the reversal trigger this ADR avoids.
- [CONTEXT.md](../../CONTEXT.md) — Webcam-layer glossary: **Webcam**, **Camera type**, **Media capability**, **Embed boundary**.
- Parent issue: `#65` — Sweden's open webcams as a layer on the transit map.
