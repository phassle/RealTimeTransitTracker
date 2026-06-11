import { useNoticeAcknowledgement } from '../hooks/useNoticeAcknowledgement';
import './PrivacyNotice.css';

export function PrivacyNotice() {
  const { acknowledged, acknowledge } = useNoticeAcknowledgement();

  if (acknowledged) return null;

  return (
    <section
      className="privacy-notice"
      role="region"
      aria-label="Privacy and data notice"
    >
      <div className="privacy-notice__body">
        <p className="privacy-notice__text">
          Live transit data:{' '}
          <a
            href="https://www.trafiklab.se/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Trafiklab
          </a>{' '}
          (CC-BY 4.0). Map tiles:{' '}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenStreetMap
          </a>
          . Webcam images:{' '}
          <a
            href="https://www.trafikverket.se/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Trafikverket
          </a>{' '}
          (hotlinked stills, fetched only when the Webcams layer is enabled).
          This site stores no tracking cookies.
        </p>
        <button
          type="button"
          className="privacy-notice__dismiss"
          onClick={acknowledge}
        >
          Got it
        </button>
      </div>
    </section>
  );
}
