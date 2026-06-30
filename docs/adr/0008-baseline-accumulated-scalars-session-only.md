# ADR 0008 — Baselines are accumulated as running scalars, span the session, and learn only the current session's normal

- **Status:** Accepted
- **Date:** 2026-06-30

## Context

PRD #84's outage and stationary rules use fixed named-constant thresholds (e.g. `VEHICLE_COLLAPSE_RATIO = 0.2` over the rolling-window peak in `feedOutageRules.js`). Idea #99 (Palantir Phase 2) replaces those with **deviation against a learned per-operator normal**: too-twitchy-at-rush-hour / too-numb-at-night thresholds give way to "is this *unusual* for this operator right now?".

The obvious path is to derive the normal the same way **Dwell spots** are derived — a pure function over the observation buffer, recomputed each poll (`learnDwellSpots(snapshots)`). That path does not work here, and the reason is worth recording because the next reader will reach for it.

The observation buffer is trimmed to a **~30-minute** rolling window ([ADR 0003](0003-client-side-incident-derivation.md)). A "session normal" must be more stable than 30 minutes of raw data — otherwise a slow city-wide decline becomes the new normal within half an hour and the rule goes numb again, reintroducing the exact failure #99 set out to fix. A normal that spans the whole session therefore **cannot be re-derived from the buffer**, because the early data it needs has already been trimmed away.

Persisting raw history (IndexedDB, a backend) would buy a longer and even cross-session normal — including genuine time-of-day learning — but [ADR 0003](0003-client-side-incident-derivation.md) and [ADR 0001](0001-cookieless-no-consent-popup.md) already rejected that for this demo: client-only, in-memory, cookieless, history dies on reload.

## Decision

Baselines are owned by a **new accumulating service**, fed each poll *as snapshots arrive* (the same poll they are appended to the buffer), not re-derived from the buffer afterwards. It stores **running scalars per operator per metric** — count, mean, and a Welford `M2` for spread, bucketed into rolling 5-minute slots — never raw observations. Consequences of this shape:

- **Survives the buffer trim.** Because only scalar aggregates are retained, the Baseline spans the entire session at negligible memory cost (~15 operators × a handful of metrics × a few floats), independent of the 30-minute raw window.
- **Reaches the rules the way Dwell spots do.** Baselines are passed into the rule functions through their existing options argument (`detectFeedOutageAnomalies(snapshots, now, { baselines })`), preserving the `(snapshots, now, opts) → Anomaly[]` signature. Clustering, inbox, and the Why-flagged evidence panel need **zero** changes.
- **Honest warm-up.** A Baseline is not consulted until it has a minimum number of completed slots; until then the deviation path stays silent and its age is surfaced, never implied (#84 story 23).
- **Learns the session's recent normal only — not time-of-day.** With no persistence there is no way to separate rush-hour from night across days. The Baseline is explicitly a *this-session, recent-normal* signal; the UI and evidence must not imply diurnal learning it does not have.
- **Tolerance band is a spread band, not a percentile.** Scalars-only storage means we keep mean + variance (cheap, exact, streamable), not a sample set or sketch, so the band is `mean ± k·stddev` with a ratio fallback when variance is degenerate. (#99's prose says "percentile bands"; percentiles would require retaining samples and are deliberately not done.)
- **Not part of a Recording.** Like a Projection ([ADR 0005](0005-projections-transient-outside-anomaly-pipeline.md)), the Baseline is live session state, re-accumulated from scratch; it is not written into the Recording envelope.

## Consequences

- The first minutes of every session run on the fixed-constant fallback (or stay silent), exactly as Dwell spots are unreliable early — accepted, and made visible rather than hidden.
- A multi-hour session that crosses a real rush-hour → evening transition will see its normal drift slowly; the slot-based rolling aggregate is intended to track that drift, not to flag it as an anomaly. Sudden collapses still deviate sharply; gradual daily rhythm does not.
- Tracer-bullet slice replaces only the **vehicle-count collapse** baseline (#84 story 11); mean-speed / stationary-share deviations are later slices and raise a separate, unresolved question about Incident **subject** geometry (an operator-wide slowdown is on-the-ground, unlike a feed outage which has no geometry) — see CONTEXT.md § Incident.

## Reversal trigger

Revisit if the product needs a normal that is stable across sessions or genuinely time-of-day aware (rush hour vs night learned over days). That requires persisted or server-side history and is the same decision [ADR 0003](0003-client-side-incident-derivation.md) defers — not this one.

## Related

- [ADR 0001](0001-cookieless-no-consent-popup.md) / [ADR 0003](0003-client-side-incident-derivation.md) — client-only, in-memory, cookieless; history dies on reload.
- [ADR 0005](0005-projections-transient-outside-anomaly-pipeline.md) — the other "derived, not persisted, not in a Recording" Command Center signal.
- [CONTEXT.md](../../CONTEXT.md) — glossary: **Baseline**, **Deviation** (and the Baseline-is-not-a-Projection / not-a-fixed-threshold distinctions).
- PRD `#84` — Command Center MVP; Idea `#99` — Baseline & deviation detection.
