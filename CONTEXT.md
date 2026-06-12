# CONTEXT — Domain glossary

Shared vocabulary for the RealTimeTransitTracker app. Use these terms in issues, PR descriptions, ADRs, code comments, and test names. When a term appears here, prefer it over synonyms.

## Webcam layer

Terms for the webcam feature (issue #65). A **Webcam** is a camera whose owner has deliberately published its imagery openly; unsecured private surveillance cameras are never Webcams in this domain, regardless of technical reachability.

### Camera type

What the camera looks at: `traffic | weather | ski | construction | wildlife`. Drives the marker badge and the type filter. Deliberately does **not** include "live" — liveness is a media property, not a subject.

### Media capability

What the app can show for a Webcam, an explicit field: `image | linkout`.

- **`image`** — the app hotlinks a static still (`<img>` fetched directly from the source, cache-busted on refresh). The only inline media this app ever renders; see the embed boundary below.
- **`linkout`** — the app shows metadata and a link to the source page; no inline media. Stream-only cameras and catalogue-sourced cameras (webcamcollections) are `linkout`.

### Source absence vs source failure

A webcam **source** (Trafikverket, Windy, the curated catalogue) is **absent** when it is not configured — e.g. its API key is omitted. Absence is a legitimate configuration: the source yields zero cameras silently, with no error surfaced.

A source **fails** when it is configured but unreachable, rejects the request, or returns a malformed response. Failure is always recorded and surfaced to the user — partially (other sources still render, with a warning naming the failed source) or fully (the layer shows an error and the next enable retries).

Absence is a configuration; failure is an error. The two must never be conflated in UI or logs.

### Embed boundary

The webcam layer never embeds third-party players or iframes (Windy player, live streams). Doing so would set third-party cookies/storage and trip the reversal trigger in [ADR 0001](docs/adr/0001-cookieless-no-consent-popup.md), forcing a full Consent surface. Hotlinked static `<img>` is treated like OSM tile loading: the network request inherently exposes the IP, nothing more.

## Privacy & disclosure

These three terms are deliberately kept distinct. They are commonly conflated in web product language; this project does not conflate them.

### Privacy Notice

A one-way, informational disclosure to the user about what data the app handles and where it comes from. A Privacy Notice **informs**; it does not ask for permission. The user's only interaction is acknowledgement.

A Privacy Notice is appropriate when there is nothing being processed conditionally on the user's answer — i.e. when the app has no non-essential storage and no non-essential processing to gate. It discharges transparency and attribution obligations without manufacturing a fake choice.

### Essential storage

Client-side storage that is **strictly necessary to provide a service the user has explicitly requested**, including the record of the user's own UI choices (such as having acknowledged a Privacy Notice, or having chosen a display theme). Essential storage does not require Consent under EU GDPR / ePrivacy because there is no processing for the user to permit or refuse — the storage *is* the user's own action being remembered.

Storage stops being essential the moment its purpose extends beyond the user's directly-requested interaction: analytics counters, A/B-test buckets, marketing identifiers, cross-visit behavioural state, and similar are **not** essential, regardless of whether they happen to live in `localStorage`, a cookie, or anywhere else.

Performance and offline caches of the app itself and of map imagery the user has already viewed are essential storage: they exist solely to deliver the service the user requested, disclose nothing to any third party, and carry no behavioural state. They do not trigger the reversal in [ADR 0001](docs/adr/0001-cookieless-no-consent-popup.md).

### Consent

A real, freely given, specific, informed, and **revocable** agreement by the user to a defined act of processing or storage that would otherwise be unlawful. Consent requires a symmetric choice — accepting and refusing must be equally easy — and presupposes that there is something to accept or refuse.

Consent is the correct surface only when there is genuine non-essential processing on offer (e.g. analytics, advertising, third-party tracking embeds). In the absence of such processing, asking for Consent is misleading: it implies practices the app does not perform, and it trains users to dismiss real consent requests elsewhere.

This project currently has no Consent surface. Introducing any non-essential storage or processing triggers the reversal described in [ADR 0001](docs/adr/0001-cookieless-no-consent-popup.md).
