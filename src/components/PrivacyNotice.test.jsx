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

  it('names airplanes.live as the aircraft data source, linked, fetched only when zoomed in', () => {
    render(<PrivacyNotice />);

    const link = screen.getByRole('link', { name: /airplanes\.live/i });
    expect(link.getAttribute('href')).toMatch(/airplanes\.live/i);
    expect(screen.getByText(/zoomed in/i)).toBeTruthy();
  });

  it('still states the site stores no tracking cookies (cookieless claim holds)', () => {
    render(<PrivacyNotice />);

    expect(screen.getByText(/stores no tracking cookies/i)).toBeTruthy();
  });

  it('introduces no Accept/Reject Consent surface — only an acknowledgement', () => {
    render(<PrivacyNotice />);

    expect(screen.queryByRole('button', { name: /accept/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /reject/i })).toBeNull();
    expect(screen.getByRole('button', { name: /got it/i })).toBeTruthy();
  });

  it('reappears for users who acknowledged an older notice version (re-disclosure)', () => {
    window.localStorage.setItem('rtt-privacy-notice-v3', '1');
    render(<PrivacyNotice />);

    expect(screen.getByText(/airplanes\.live/i)).toBeTruthy();
  });
});
