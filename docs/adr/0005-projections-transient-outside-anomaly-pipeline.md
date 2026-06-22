# ADR 0005 — Projections are transient, derived per-poll, and live outside the Anomaly→Incident pipeline

- **Status:** Accepted
- **Date:** 2026-06-22

## Context

The Command Center (PRD #84) is entirely retrospective: it surfaces *what has already gone wrong* (an Anomaly clustered into an Incident with a timeline). PRD #136 adds the opposite-facing question — *who is about to be affected?* — as an **Expected impact** forecast for a geographic Incident: the lines and directions running *behind* the disruption that are likely to degrade.

The obvious path is to reuse the machinery already in place: emit the forecast as an Anomaly, let `clusterIncidents` fold it onto the Incident, and render it from the timeline like every other piece of evidence. That path is wrong here, and committing to it is hard to walk back.

A forecast is categorically different from an Anomaly:

- An **Anomaly** is an observation — a rule matched a fact at a point in time. It is a historical record and belongs on the timeline forever.
- A **Projection** is a prediction — it has not happened, it changes every poll as reality moves, and it must *retract* (vanish) the instant the disruption clears. Persisting it on a timeline would turn a guess into a permanent claim and pollute the inbox with situations that never occurred.

## Decision

The Expected impact forecast is a **Projection**, computed by a new pure service `etaProjection` (`predictImpact(incident, buffer, now) → projection | null`). The Projection:

- **Lives outside the Anomaly→Incident pipeline.** `predictImpact` reads the observation buffer and the Incident; it never produces an Anomaly and never touches the `clusterIncidents` seam.
- **Is transient and derived per poll.** It is recomputed for the **selected** Incident only, exposed as `selectedIncident.projection`. It is never persisted, never part of a Recording's required state, and never on the timeline.
- **Retracts by construction.** When the underlying stall clears, the next poll's recomputation returns `null` and the section (and any map accent) disappears. There is nothing to "resolve" because there was never a stored record.
- **Is scoped to geographic Incidents.** Operator-subject (feed outage) Incidents have no ground geometry, so they get no Projection and no section.
- **Carries structured evidence; presenters render text.** Like the rest of the Command Center, a Projection is auditable from its inputs; rules never produce display strings.

## Consequences

- **"Behind" without route geometry.** No GTFS static stops or route polyline are available, so a Downstream vehicle cannot be defined by stop sequence. "Behind the disruption" is a deliberately coarse geometric heuristic: same `(operator, line, direction)`, plus a bearing dot-product test (the candidate has not yet passed the stall point along the stalled vehicle's heading) and a `MAX_DOWNSTREAM_DISTANCE_M` cap (slice 2, `etaProjection.isBehind`). This imprecision is accepted as the cost of the zero-extra-data constraint (ADR 0001/0003) and is recorded here rather than as a separate ADR.
- **Delay magnitude without a schedule.** With no GTFS static schedule there is no real headway to read, so the magnitude is also coarse (slice 3). First-order it is the measured stall duration (`measuredStationaryMs` from the stationary Anomaly's evidence); it is refined by the growth in a *time-headway proxy* — the spatial gap between the nearest Downstream vehicle and the stall, converted at a nominal `REFERENCE_SPEED_MPS`, compared across the buffer window. Lacking ≥2 snapshots of that gap, it falls back to the stall duration alone. The estimate is surfaced only as a low-precision bucket (`coarseDelayLabel`: ~5 / ~10 / 10+ min); structured inputs (`measuredStationaryMs`, `headwayBaselineMs`, `gapGrowthMs`, `estimatedDelayMs`) accompany it so the forecast stays auditable — the presenter renders text, the rule never does.
- **Walking skeleton first.** Slice 1 ships the simplest line+direction match; confidence gating (a `CONFIDENCE_FLOOR` below which `predictImpact` returns `null` — silence over a guess) arrives in a later slice without changing this structural decision.
- **Downstream code must not assume persistence.** Because a Projection is recomputed and may vanish each poll, no consumer may store it, key off it across polls, or treat it as a stable Incident field.

## Trade-offs

- **Transient-derived vs persisted-auditable.** A persisted forecast would be trivially replayable and inspectable after the fact; a transient one is not. We accept this: a prediction that lingered after reality moved would be actively misleading, which is worse than not being able to replay it. Auditability is preserved through the structured evidence shown live, not through persistence.
- **Recomputation cost.** Recomputing every poll for the selected Incident is cheap (one snapshot, in-memory) and keeps the forecast honest; it is not amortised or cached across polls by design.

## Reversal trigger

Revisit if Projections ever need to be persisted, audited after the fact, or shown for unselected Incidents — e.g. if the product wants a history of past forecasts vs. outcomes. That would justify a stored, versioned Projection record and is a different decision from this one.

## Related

- [ADR 0001](0001-cookieless-no-consent-popup.md) / [ADR 0003](0003-client-side-incident-derivation.md) — everything is derived client-side, in-memory, with no new feed/network calls.
- [CONTEXT.md](../../CONTEXT.md) — glossary: **Projection**, **Downstream vehicles** (and the Projection-is-not-an-Anomaly distinction).
- PRD `#136` — Predictive ETA degradation; issue `#137` — Slice 1 walking skeleton.
