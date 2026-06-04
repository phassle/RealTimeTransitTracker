# ADR 0001 — Cookieless app ships a Privacy Notice, not a Consent gate

- **Status:** Accepted
- **Date:** 2026-06-04

## Context

The app is a client-only SPA that shows live transit data on a map. It loads vehicle positions from a third-party API (Trafiklab, GTFS-RT, CC-BY 4.0) and map tiles from a third-party tile server (OpenStreetMap). It stores no analytics identifiers, no advertising identifiers, and no cross-visit tracking state. The only client-side storage is a single flag that records whether the user has dismissed the data-source disclosure — i.e. a record of the user's own UI choice.

Under EU GDPR and the ePrivacy Directive, prior consent is required for storage or access of information on the user's device **only when that storage is non-essential**. Storage strictly necessary to deliver a service the user has requested — including remembering the user's own UI preferences — is exempt. Consent is also only meaningful when there is a real, symmetric choice to accept or reject some processing.

There is currently no non-essential processing in this app to accept or reject.

## Decision

Ship an informational **Privacy Notice** on first visit. Do **not** ship a consent gate or cookie banner.

The notice:

- Discloses the third-party data sources and their licences (transparency / attribution obligation).
- States plainly that the app stores no tracking cookies and no analytics.
- Is dismissible with a single acknowledgement; dismissal is remembered so it does not nag returning users.
- Is non-blocking: the map is usable before and during dismissal.
- Carries no "Accept" / "Reject" symmetry, because there is nothing being processed conditionally on the user's answer.

## Rationale

- **Honesty over theatre.** Showing a consent popup when there is nothing to consent to misrepresents the data practices. It implies the existence of tracking the app does not perform.
- **Avoids the dark-pattern trap.** A cookie banner that exists only to be clicked away trains users to dismiss real consent requests without reading them, eroding the meaning of consent across the web.
- **Discharges the actual obligation.** What this app genuinely owes the user is *transparency about its data sources* and *attribution for licensed content* — both met by a plain notice.
- **Keeps essential storage genuinely essential.** The one stored value (the user's dismissal acknowledgement) is the record of a UI interaction the user themselves performed; treating it as consent-bearing would be circular.

## Trade-offs

- A naive auditor scanning for the presence of a cookie banner may flag the app as non-compliant on first glance. Mitigation: this ADR exists to make the reasoning auditable, and the notice itself names what is and is not stored.
- If a future contributor adds analytics, advertising pixels, embedded third-party iframes that set cookies, or any other non-essential client-side processing **without** also reading this ADR, the app silently slips out of compliance. The notice will still display the old, now-untrue claim. Mitigation: see reversal trigger below.

## Reversal trigger

This decision is reversed — and the Privacy Notice is upgraded to a real two-category opt-in consent surface — the moment **any** of the following is introduced:

- Analytics of any kind (first-party or third-party, including self-hosted).
- Any non-essential cookie or client storage (e.g. preference state that is not strictly the user's own UI choice; A/B-test buckets; marketing identifiers).
- Embedded third-party content that sets cookies or fingerprintable storage on the user's device.
- Any feature that shares user-identifying data with a third party beyond what the network request inherently exposes (e.g. sending coordinates to a non-tile-serving service).

Geolocation / viewport-tracking permission UX is **separate** from this decision and is governed by the browser-native permission prompt, not by this notice.

## Consequences

- The shipped UI surface is a notice, not a gate. No accept/reject buttons.
- Dismissal is persisted in essential client storage under a versioned key so that bumping the version re-discloses to every user when data practices change.
- Storage failure (private mode, blocked storage) is non-fatal: the notice simply reappears next visit.
- This ADR is the canonical record of *why there is no cookie banner*; future contributors should not introduce one without first invoking the reversal trigger above.

## Related

- [CONTEXT.md](../../CONTEXT.md) — glossary distinguishing **Privacy Notice**, **Essential storage**, and **Consent**.
- Parent PRD: `#22` — Privacy / data notice (cookieless transparency banner).
