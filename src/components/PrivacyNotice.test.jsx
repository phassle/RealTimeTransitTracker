import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PrivacyNotice } from './PrivacyNotice';

describe('PrivacyNotice', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('names Trafikverket as a third-party image source', () => {
    render(<PrivacyNotice />);

    expect(screen.getByText(/Trafikverket/i)).toBeTruthy();
  });

  it('still names the existing transit and tile sources', () => {
    render(<PrivacyNotice />);

    expect(screen.getByText(/Trafiklab/i)).toBeTruthy();
    expect(screen.getByText(/OpenStreetMap/i)).toBeTruthy();
  });

  it('names every webcam data source: Windy and the curated catalogue', () => {
    render(<PrivacyNotice />);

    expect(screen.getByText(/Windy/i)).toBeTruthy();
    expect(screen.getByText(/curated webcam catalogue/i)).toBeTruthy();
  });

  it('reappears for users who acknowledged an older notice version (re-disclosure)', () => {
    window.localStorage.setItem('rtt-privacy-notice-v2', '1');
    render(<PrivacyNotice />);

    expect(screen.getByText(/Windy/i)).toBeTruthy();
  });
});
