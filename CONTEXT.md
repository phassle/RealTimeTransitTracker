# CONTEXT — Domain glossary

Shared vocabulary for the RealTimeTransitTracker app. Use these terms in issues, PR descriptions, ADRs, code comments, and test names. When a term appears here, prefer it over synonyms.

## Marker-collection module

The canonical marker lifecycle (diff-by-id, remove stale, update-or-create, reuse-not-recreate, popup wiring) lives in **`src/services/markerCollection.js`**. It maintains a set of Leaflet markers keyed by item id and accepts per-update adapters (`toLatLng`, `toIcon`, `toPopup`, optional `onUpdate`) so that any item type can drive the same lifecycle without duplicating the algorithm.

`escapeHtml` — the canonical HTML-escaping function (null-safe, escapes apostrophe) — is exported from this module and used by all popup paths.

The **vehicle adapter** (`src/services/vehicleAdapter.js`) is the first adapter over this interface; it owns vehicle icon construction and popup markup.

## Transport modes

The canonical set of vehicle transport modes, owned entirely by **`src/services/modes.js`**. That module is the single source of truth for the mode list, display label, marker/swatch color, marker icon, and the GTFS `route_type` → mode mapping. All consumers (map renderer, control panel, app state) import from it; none declare their own mode list or color table.

A mode is a **vehicle category for marker styling and filtering** — it is *not* defined by GTFS. Most modes derive from a GTFS `route_type` (the `GTFS_ROUTE_TYPE_TO_MODE` table), but a mode may also come from a non-GTFS source: `aircraft` and `helicopter` originate from the airplanes.live feed and have no `route_type`. So `modes.js` owns the full mode list while `GTFS_ROUTE_TYPE_TO_MODE` deliberately covers only the GTFS-sourced subset.

The current canonical modes are: `metro | bus | train | tram | ferry | aircraft | helicopter | unknown`.

`ship` is not a mode: no source produces it. GTFS route type 1000 (Water Transport) maps to `ferry`.

## Vehicle

A moving object on the map carrying position, `bearing`, `speed`, a `mode`, and a `line`, managed through the keyed marker-collection. Transit Vehicles come from GTFS-RT and carry an `operator`; an **Aircraft** (mode `aircraft` or `helicopter`, from airplanes.live) is a Vehicle with **no operator**. A User location is not a Vehicle (see above).

A **Line** is a public-transport line designator (a route number such as `4` or `Pendeltåg 41`). An aircraft callsign is **not** a Line: it is carried in the Vehicle's `line` field only to label the marker, and is deliberately excluded from the line filter (Available lines lists transit lines only). Aircraft are filterable by mode, not by callsign.

Aircraft are **not transit observations**: they never enter the command-center pipeline (observation buffer, Anomaly rules, Dwell spots, Feed outage, Projection). A hovering helicopter is not a stationary-vehicle Anomaly, and airplanes.live is not a Watched operator.

## Followed vehicle

A single Vehicle the user has chosen to keep centred: clicking a vehicle's **Follow** control pans the map to it on every position update while keeping the current zoom. It is a **session-only singleton** (forgotten on reload) and orthogonal to the command-center selection/highlight — a vehicle can be both followed and highlighted, and the follow accent composes with the highlight ring rather than replacing it. Following ends when the user stops it, clicks the map background, or the followed Vehicle leaves the feed (exited silently, never an error). Any Vehicle is followable, Aircraft included.

## User location

The map position acquired from the browser's native geolocation, shown as a single "you are here" marker. A User location is **not** a Vehicle: it carries no line, mode, or operator, is styled as a distinct accent (never a transport-mode colour), and never enters the keyed marker-collection — it is one circle marker managed directly in `Map.jsx`. It is a **session-only singleton**: re-locating moves the one marker rather than accumulating, and it is forgotten on reload. Avoid the synonyms "GPS pin" / "current location".

All `navigator.geolocation` interaction lives behind the **`useGeolocation`** hook (`locate()`, `position`, `status`), where `status` is the discriminated enum `idle | locating | success | denied | unavailable` (`denied` = the user declined; `unavailable` = no API / insecure origin — never conflated). The position is **ephemeral and client-only** ([ADR 0006](docs/adr/0006-geolocation-ephemeral-client-only.md)): held in memory only, never written to client storage and never sent to any service, so the browser-native permission prompt is the only gate — no Consent surface and no Privacy Notice change.

## Filter-selection module

Filter state — enabled modes, selected lines, and the mode/line invariant — is owned entirely by **`src/hooks/useFilterSelection.js`**. No consumer builds or parses selection keys; the hook exposes `{mode, line}` objects and an `isLineSelected(mode, line)` predicate.

**Mode/line invariant:** disabling a mode immediately clears every line selection for that mode. The invariant is enforced inside the hook on every `toggleMode` call; no caller needs to handle it.

**Available lines:** derived from the live vehicle set, grouped per mode, numerically sorted. Lines for a disabled mode are excluded. `filteredVehicles` is the hook's primary output: the vehicle list after both mode and line filters are applied.

**Favourite line:** a persisted line the user has pinned via its star control, so that it is **pre-selected automatically on the next visit**. A Favourite is distinct from a Selection: a **Selection** is ephemeral session state (it evaporates on reload); a **Favourite** is persistent. They are orthogonal axes — a line can be favourited without being selected this session, and selected without being favourited. On a fresh load, Favourites *seed* the Selection (a one-time initialisation, not a continuous binding); deselecting a seeded line during the session does not unfavourite it and is not re-seeded, so the next fresh load re-selects it. Disabling a mode clears that mode's *selections* but leaves its Favourites intact.

_Avoid_: pinned line, starred line, saved line (the UI control is a star; the concept is a **Favourite**).

Favourites are owned by the same hook, alongside Selection, and exposed only as `{mode, line}` objects via `isLineFavourite(mode, line)` / `toggleFavourite(mode, line)` / `clearFavourites()` — no consumer builds or parses keys. They persist write-through under a versioned localStorage key (`rtt-favourite-lines-v1`), reading defensively so a malformed or partial value degrades to the valid entries (or none) rather than crashing. Favourites are **Essential storage** under [ADR 0001](docs/adr/0001-cookieless-no-consent-popup.md): a record of the user's own UI choice, exactly like theme — no Consent surface, and they must never drift into passively-collected behavioural state.

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

## Operational picture (command center)

Terms for the command-center demo. These three are deliberately distinct; "case" is **not** part of this vocabulary — say Incident.

### Anomaly

A single rule hit at a point in time: one detection rule matching one observation (e.g. "vehicle stationary > threshold" firing for one vehicle at 08:42). Anomalies are raw, high-volume signals. They are never shown directly in the Incident Inbox; they exist to feed Incidents and appear only on an Incident's timeline.

Every Anomaly carries **evidence**: the rule that fired, its threshold, the measured value, the affected vehicles/lines, and when it started. "Why flagged?" explanations are rendered from evidence, never free-written — every claim shown to the analyst traces back to an Anomaly on the timeline.

### Incident

An ongoing situation with a lifecycle (open → resolved) that clusters related Anomalies in time and space — possibly from different rules. One stationary bus re-detected every poll, plus a bus bunching detection nearby moments later, is **one** Incident with several Anomalies on its timeline, not several inbox rows. The Incident Inbox lists Incidents only.

Every Incident has a **subject**: either a geographic area or an operator. A feed outage is an Incident whose subject is the operator — it has no geometry and is never drawn as if it were traffic on the ground.

An Incident whose data source has gone blind (its operator's feed is out) becomes **stale**: it is frozen and flagged, not auto-resolved. Absence of data is never evidence that a situation resolved.

### Feed outage

An Incident whose subject is an operator, fed by any of three Anomaly signals: repeated fetch failures, a feed that responds but whose data timestamps have stopped advancing, or a sudden collapse in vehicle count. A technically "up" feed with dead or decimated data is still an outage.

### Watched operator

An operator currently being polled (its region intersects the viewport). Only watched operators can have a known feed status; an unwatched operator is **not watched** — never "down". Absence of polling is not evidence of absence of service.

### Dwell spot

A location where vehicles standing still is normal — terminals, depots, layover points. Learned during the session from observation history (many distinct vehicles stationary at the same spot over time), not from a static dataset. Detections at a Dwell spot are suppressed, not surfaced as Anomalies.

### Replay

Playing back the session's own observation history — from tab open, capped at a rolling window — to show how a situation developed. Replay never claims history from before the session started.

### Recording

A Replay buffer exported to a file, loadable back into the app later. The mechanism for rehearsable demos and post-hoc analysis; lives on the user's disk, not in client storage.

### Verification

An analyst action linking a Webcam to an Incident as visual confirmation ("this camera shows the queue"). Recorded on the Incident's timeline alongside Anomalies. Verification is human judgement; the system never marks a camera as verifying anything on its own.

### Injected Incident

A synthetic Incident inserted on demand to make a demo reproducible. Always explicitly labelled as demo content in the UI; never mixed silently with real detections. All live, non-injected data is real.

### Projection

A forward-looking derivation for a geographic Incident: a forecast of who is *about to* be affected by a known disruption (UI label "Expected impact"). A Projection is **not** an Anomaly — an Anomaly detects something that already happened; a Projection predicts something that has not. It is never asserted as fact: it is worded as a hedge ("likely", "expected") and is always rendered **visually distinct** from observed evidence so a prediction is never mistaken for an observation. It produces no Anomaly, creates no Incident, inbox row, or timeline entry, and is recomputed transiently per poll for the selected Incident only — it retracts (disappears) the moment the disruption clears (see [ADR 0005](docs/adr/0005-projections-transient-outside-anomaly-pipeline.md)). Like every detection it is auditable: every claim traces to the structured inputs it was computed from, and below a confidence floor the app stays silent rather than guessing.

### Downstream vehicles

The vehicles a Projection flags as likely to degrade: vehicles on the same `(operator, line, direction)` as the disruption that have **not yet passed** the stall point (they are still behind it). Same line but opposite direction is not downstream; a vehicle already past the stall point is not downstream. With no GTFS static stops or route polyline available, "behind" is a deliberately coarse geometric heuristic rather than a stop-sequence fact.

## Privacy & disclosure

These three terms are deliberately kept distinct. They are commonly conflated in web product language; this project does not conflate them.

### Privacy Notice

A one-way, informational disclosure to the user about what data the app handles and where it comes from. A Privacy Notice **informs**; it does not ask for permission. The user's only interaction is acknowledgement.

A Privacy Notice is appropriate when there is nothing being processed conditionally on the user's answer — i.e. when the app has no non-essential storage and no non-essential processing to gate. It discharges transparency and attribution obligations without manufacturing a fake choice.

The notice names every active third-party data source: Trafiklab, OpenStreetMap, the webcam sources, and — for the aircraft layer — **airplanes.live** (linked, annotated that it is fetched only while zoomed in, under Non-Commercial Use with no SLA). airplanes.live is the **same trust category** as the existing third-party fetches, so it needs **no Consent surface** and leaves ADR 0001's cookieless posture intact ([ADR 0007](docs/adr/0007-aircraft-airplanes-live-client-side.md)). Adding it bumped the notice's storage version so every returning user is re-disclosed once.

### Essential storage

Client-side storage that is **strictly necessary to provide a service the user has explicitly requested**, including the record of the user's own UI choices (such as having acknowledged a Privacy Notice, or having chosen a display theme). Essential storage does not require Consent under EU GDPR / ePrivacy because there is no processing for the user to permit or refuse — the storage *is* the user's own action being remembered.

Storage stops being essential the moment its purpose extends beyond the user's directly-requested interaction: analytics counters, A/B-test buckets, marketing identifiers, cross-visit behavioural state, and similar are **not** essential, regardless of whether they happen to live in `localStorage`, a cookie, or anywhere else.

Performance and offline caches of the app itself and of map imagery the user has already viewed are essential storage: they exist solely to deliver the service the user requested, disclose nothing to any third party, and carry no behavioural state. They do not trigger the reversal in [ADR 0001](docs/adr/0001-cookieless-no-consent-popup.md).

### Consent

A real, freely given, specific, informed, and **revocable** agreement by the user to a defined act of processing or storage that would otherwise be unlawful. Consent requires a symmetric choice — accepting and refusing must be equally easy — and presupposes that there is something to accept or refuse.

Consent is the correct surface only when there is genuine non-essential processing on offer (e.g. analytics, advertising, third-party tracking embeds). In the absence of such processing, asking for Consent is misleading: it implies practices the app does not perform, and it trains users to dismiss real consent requests elsewhere.

This project currently has no Consent surface. Introducing any non-essential storage or processing triggers the reversal described in [ADR 0001](docs/adr/0001-cookieless-no-consent-popup.md).
