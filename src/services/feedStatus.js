// Feed status — pure derivation of watched/not-watched per operator.
//
// A Watched operator is one currently being polled (its region intersects the
// viewport) — only watched operators have a known feed status. An operator that
// is not polled is "not watched", NEVER "down": absence of polling is not
// evidence of absence of service (CONTEXT.md § Watched operator, PRD #84 #13).
//
// `latestFeeds` are the per-operator fetch outcomes from the most recent poll
// ({ operator, ok, ... }); `operators` is the full operator registry.

/**
 * @param {object[]} latestFeeds per-operator outcomes from the latest poll
 * @param {{ slug: string, name: string }[]} operators
 * @returns {{ operator: string, name: string, watched: boolean, healthy: boolean|null }[]}
 */
export function operatorFeedStatuses(latestFeeds = [], operators = []) {
  const byOperator = new Map((latestFeeds ?? []).map((f) => [f.operator, f]));
  return operators.map((op) => {
    const feed = byOperator.get(op.slug);
    const watched = Boolean(feed);
    return {
      operator: op.slug,
      name: op.name,
      watched,
      // null = unknown (not watched); never report an unwatched feed as down.
      healthy: watched ? Boolean(feed.ok) : null,
    };
  });
}
