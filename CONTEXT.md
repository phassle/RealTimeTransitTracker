# CONTEXT — Domain glossary

Shared vocabulary for the RealTimeTransitTracker app. Use these terms in issues, PR descriptions, ADRs, code comments, and test names. When a term appears here, prefer it over synonyms.

## Privacy & disclosure

These three terms are deliberately kept distinct. They are commonly conflated in web product language; this project does not conflate them.

### Privacy Notice

A one-way, informational disclosure to the user about what data the app handles and where it comes from. A Privacy Notice **informs**; it does not ask for permission. The user's only interaction is acknowledgement.

A Privacy Notice is appropriate when there is nothing being processed conditionally on the user's answer — i.e. when the app has no non-essential storage and no non-essential processing to gate. It discharges transparency and attribution obligations without manufacturing a fake choice.

### Essential storage

Client-side storage that is **strictly necessary to provide a service the user has explicitly requested**, including the record of the user's own UI choices (such as having acknowledged a Privacy Notice). Essential storage does not require Consent under EU GDPR / ePrivacy because there is no processing for the user to permit or refuse — the storage *is* the user's own action being remembered.

Storage stops being essential the moment its purpose extends beyond the user's directly-requested interaction: analytics counters, A/B-test buckets, marketing identifiers, cross-visit behavioural state, and similar are **not** essential, regardless of whether they happen to live in `localStorage`, a cookie, or anywhere else.

### Consent

A real, freely given, specific, informed, and **revocable** agreement by the user to a defined act of processing or storage that would otherwise be unlawful. Consent requires a symmetric choice — accepting and refusing must be equally easy — and presupposes that there is something to accept or refuse.

Consent is the correct surface only when there is genuine non-essential processing on offer (e.g. analytics, advertising, third-party tracking embeds). In the absence of such processing, asking for Consent is misleading: it implies practices the app does not perform, and it trains users to dismiss real consent requests elsewhere.

This project currently has no Consent surface. Introducing any non-essential storage or processing triggers the reversal described in [ADR 0001](docs/adr/0001-cookieless-no-consent-popup.md).
