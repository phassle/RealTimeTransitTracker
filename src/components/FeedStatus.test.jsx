import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeedStatus } from './FeedStatus';

describe('FeedStatus', () => {
  const statuses = [
    { operator: 'sl', name: 'SL', watched: true, healthy: true },
    { operator: 'ul', name: 'UL', watched: true, healthy: false },
    { operator: 'skane', name: 'Skånetrafiken', watched: false, healthy: null },
  ];

  it('shows watched operators with their feed health', () => {
    render(<FeedStatus statuses={statuses} />);
    expect(screen.getByText('SL')).toBeDefined();
    expect(screen.getByText('UL')).toBeDefined();
  });

  it('reads an unwatched operator as "not watched", never down', () => {
    render(<FeedStatus statuses={statuses} />);
    const skane = screen.getByText('Skånetrafiken').closest('li');
    expect(skane.textContent).toMatch(/not watched/i);
    expect(skane.textContent).not.toMatch(/down/i);
  });

  it('renders nothing useful but does not crash with no statuses', () => {
    render(<FeedStatus statuses={[]} />);
    expect(screen.getByLabelText('Feed status')).toBeDefined();
  });
});
