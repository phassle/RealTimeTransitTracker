import './UpdateToast.css';

export function UpdateToast({ isVisible, onReload, onDismiss }) {
  if (!isVisible) return null;
  return (
    <div className="update-toast" role="status" aria-live="polite">
      <span>New version available — reload</span>
      <button onClick={onReload}>Reload</button>
      <button onClick={onDismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}
