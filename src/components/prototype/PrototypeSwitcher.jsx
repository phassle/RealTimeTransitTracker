// PROTOTYPE — throwaway floating switcher. Hidden in production builds.
import { useEffect } from 'react';
import './PrototypeSwitcher.css';

// Keep in sync with FancyControlPanel's variant map.
const VARIANTS = [
  { key: 'A', name: 'Glass HUD' },
  { key: 'B', name: 'Command Dock' },
  { key: 'C', name: 'Icon Rail · Palantir' },
  { key: 'original', name: 'Original (current)' },
];

function setVariant(key) {
  const url = new URL(window.location.href);
  url.searchParams.set('variant', key);
  window.history.replaceState({}, '', url);
  // No router in this SPA — nudge React via a popstate so the param re-reads.
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function PrototypeSwitcher({ current }) {
  const idx = Math.max(0, VARIANTS.findIndex(v => v.key === current));
  const cur = VARIANTS[idx];

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      const typing =
        t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (typing) return;
      if (e.key === 'ArrowLeft') setVariant(VARIANTS[(idx - 1 + VARIANTS.length) % VARIANTS.length].key);
      if (e.key === 'ArrowRight') setVariant(VARIANTS[(idx + 1) % VARIANTS.length].key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx]);

  return (
    <div className="proto-switcher" role="group" aria-label="Prototype variant switcher">
      <button
        className="proto-switcher-arrow"
        onClick={() => setVariant(VARIANTS[(idx - 1 + VARIANTS.length) % VARIANTS.length].key)}
        aria-label="Previous variant"
      >
        ‹
      </button>
      <span className="proto-switcher-label">
        <strong>{cur.key}</strong> — {cur.name}
      </span>
      <button
        className="proto-switcher-arrow"
        onClick={() => setVariant(VARIANTS[(idx + 1) % VARIANTS.length].key)}
        aria-label="Next variant"
      >
        ›
      </button>
    </div>
  );
}
