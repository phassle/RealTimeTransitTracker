import './FeedStatus.css';

// Feed status panel — watched vs not-watched, per operator. Only WATCHED
// operators (region in the viewport, currently polled) carry a known feed
// health; everything else reads "not watched" — never "down". Absence of
// polling is not evidence of absence of service (CONTEXT.md § Watched operator,
// PRD #84 #13). Pure presenter over operatorFeedStatuses().
export function FeedStatus({ statuses = [] }) {
  const watched = statuses.filter((s) => s.watched);
  const notWatched = statuses.filter((s) => !s.watched);

  return (
    <section className="feed-status" aria-label="Feed status">
      <h3 className="feed-status__heading">Feed status</h3>
      <ul className="feed-status__list" role="list">
        {watched.map((s) => (
          <li
            key={s.operator}
            className={`feed-status__item feed-status__item--${s.healthy ? 'live' : 'issue'}`}
          >
            <span className="feed-status__name">{s.name}</span>
            <span className="feed-status__state">{s.healthy ? 'Live' : 'Feed issue'}</span>
          </li>
        ))}
        {notWatched.map((s) => (
          <li key={s.operator} className="feed-status__item feed-status__item--unwatched">
            <span className="feed-status__name">{s.name}</span>
            <span className="feed-status__state">Not watched</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
