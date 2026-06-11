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
});
