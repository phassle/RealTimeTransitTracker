import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReplayControls } from './ReplayControls';

function liveReplay(overrides = {}) {
  return {
    isReplaying: false,
    viewedTime: null,
    sessionStart: 1_000,
    sessionEnd: 5_000,
    scrubTo: vi.fn(),
    returnToLive: vi.fn(),
    ...overrides,
  };
}

describe('ReplayControls', () => {
  it('renders nothing until the session has observations', () => {
    const { container } = render(
      <ReplayControls replay={liveReplay({ sessionStart: null, sessionEnd: null })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('in live mode shows no past indicator and a scrub slider', () => {
    render(<ReplayControls replay={liveReplay()} />);
    expect(screen.queryByText(/viewing the past/i)).toBeNull();
    expect(screen.getByRole('slider')).toBeDefined();
  });

  it('scrubbing the slider reads the past at that moment', () => {
    const replay = liveReplay();
    render(<ReplayControls replay={replay} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '3000' } });
    expect(replay.scrubTo).toHaveBeenCalledWith(3000);
  });

  it('in past mode shows an unmistakable past indicator with the viewed time', () => {
    const viewedTime = Date.UTC(2026, 5, 12, 8, 30, 0);
    render(<ReplayControls replay={liveReplay({ isReplaying: true, viewedTime })} />);
    const indicator = screen.getByRole('status');
    expect(indicator.textContent).toMatch(/viewing the past/i);
    // the viewed timestamp is shown
    expect(indicator.textContent).toMatch(/\d{1,2}:\d{2}/);
  });

  it('one click on return-to-live exits the past', () => {
    const replay = liveReplay({ isReplaying: true, viewedTime: 3000 });
    render(<ReplayControls replay={replay} />);
    fireEvent.click(screen.getByRole('button', { name: /return to live/i }));
    expect(replay.returnToLive).toHaveBeenCalledTimes(1);
  });
});
