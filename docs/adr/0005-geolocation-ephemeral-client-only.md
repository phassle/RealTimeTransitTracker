# ADR 0005 — Geolocation is ephemeral and client-only

- **Status:** Accepted
- **Date:** 2026-06-16

## Context

The "locate me" feature (PRD #111, first slice #112) acquires the user's position from the browser's native geolocation API to centre the map on where they are. A position is the most identifying data this app handles: it is personal data, and a history of positions would be a record of where the user has physically been.

The app's privacy posture ([ADR 0001](0001-cookieless-no-consent-popup.md)) is cookieless with a Privacy Notice and **no** Consent surface, on the strict condition that the app performs no non-essential storage and no third-party processing of personal data. Persisting the user's location across visits, or sending coordinates to any non-tile service (reverse geocoding, nearest-stop lookup), would be exactly the kind of non-essential processing that reverses ADR 0001 and obliges a real Consent gate.

The browser already provides a native permission prompt for geolocation — a familiar, OS-level, revocable gate that the user trusts.

## Decision

The User location is **ephemeral and client-only**:

- It is held in React state only (the `useGeolocation` hook), for the duration of the session, and forgotten on reload.
- It is **never** written to client storage (no `localStorage`, no cookie, no IndexedDB).
- It is **never** sent to any service. The only network effect of locating is that moving the map viewport triggers the operators-in-viewport feed fetch the app already performs — those calls carry the viewport, not the user's coordinates.
- Permission is governed **solely** by the browser-native prompt. The app adds no custom consent dialog and makes no Privacy Notice change.

## Rationale

- **Keeps ADR 0001 standing.** No non-essential storage and no third-party coordinate sharing are introduced, so the cookieless Privacy-Notice posture survives intact and no Consent surface is required.
- **Native prompt is the right gate.** Geolocation is the one capability browsers already gate with a trusted, revocable permission; re-implementing consent in-app would be redundant and less trustworthy.
- **Least data held.** Using the position in the moment and forgetting it means the app cannot build a location history even accidentally.

## Trade-offs

- The user re-grants (or the browser re-confirms) on each fresh visit; there is no "remember my location". This is intentional — story 13 ("no memory of my previous location") is a feature, not a gap.
- A future "last location" convenience would require persisting a position, which is non-essential storage: it triggers the ADR 0001 reversal and must stand up a Consent surface first.

## Reversal trigger

Persisting the User location across reloads/visits, or sending coordinates to any non-tile service, reverses this decision and ADR 0001 together: the project must then ship the full Consent surface ADR 0001 prescribes, and the location feature lives behind that consent — never before it.

## Related

- [ADR 0001](0001-cookieless-no-consent-popup.md) — cookieless app, Privacy Notice not Consent gate; defines the reversal trigger this ADR avoids.
- [CONTEXT.md](../../CONTEXT.md) — **User location** glossary term.
- PRD: `#111` — Geolocation, "locate me" centres the map. First slice: `#112`.
