import './OfflineBanner.css';

export function OfflineBanner({ isOnline }) {
  if (isOnline) return null;
  return (
    <div className="offline-banner" role="alert" aria-live="assertive">
      Offline — live data unavailable
    </div>
  );
}
