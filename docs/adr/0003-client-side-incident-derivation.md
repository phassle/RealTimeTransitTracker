# Incidents are derived client-side from the session's own observation window

The command-center features (Incident Inbox, anomaly detection, Replay, Dwell spots) run entirely in the browser on the observation history the open tab has accumulated — no backend, no server-side history, in keeping with the app's client-only SPA shape and cookieless posture (ADR 0001). A backend would have bought persistent history, nationwide feed-health monitoring, and cross-session learning, but at the cost of infrastructure this demo project deliberately doesn't have.

## Consequences

- History starts at tab open and dies on refresh; Replay can never show more than the session window. Rehearsable demos use exported Recordings (files on disk), not client storage.
- Feed status is only knowable for Watched operators (viewport-driven polling, rate-limit budget); unwatched operators are "not watched", never "down".
- Dwell spots are re-learned each session and are unreliable in the first minutes after tab open.
- Reconsider if the product needs cross-session history, alerting while no tab is open, or nationwide feed health — those genuinely require a backend.
