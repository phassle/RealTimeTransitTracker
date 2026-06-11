import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfflineBanner } from './OfflineBanner';

describe('OfflineBanner', () => {
  it('renders banner when offline', () => {
    render(<OfflineBanner isOnline={false} />);
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Offline — live data unavailable')).toBeDefined();
  });

  it('renders nothing when online', () => {
    const { container } = render(<OfflineBanner isOnline={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('is visually distinct: has offline-banner class', () => {
    render(<OfflineBanner isOnline={false} />);
    expect(document.querySelector('.offline-banner')).toBeTruthy();
  });
});
