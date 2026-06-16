import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocateControl } from './LocateControl';

describe('LocateControl', () => {
  it('renders a labelled, focusable button', () => {
    render(<LocateControl status="idle" onLocate={() => {}} />);
    const btn = screen.getByRole('button', { name: /locate/i });
    expect(btn).toBeTruthy();
    expect(btn.tagName).toBe('BUTTON');
  });

  it('calls onLocate when tapped', () => {
    const onLocate = vi.fn();
    render(<LocateControl status="idle" onLocate={onLocate} />);
    fireEvent.click(screen.getByRole('button', { name: /locate/i }));
    expect(onLocate).toHaveBeenCalledTimes(1);
  });

  it('disables the button while a fix is being acquired', () => {
    render(<LocateControl status="locating" onLocate={() => {}} />);
    expect(screen.getByRole('button', { name: /locat/i }).disabled).toBe(true);
  });

  it('is enabled again after a successful fix', () => {
    render(<LocateControl status="success" onLocate={() => {}} />);
    expect(screen.getByRole('button', { name: /locate/i }).disabled).toBe(false);
  });

  it('disables the button and explains the decline when permission is denied', () => {
    render(<LocateControl status="denied" onLocate={() => {}} />);
    const btn = screen.getByRole('button', { name: /locat/i });
    expect(btn.disabled).toBe(true);
    expect(btn.title).toBe('you declined location access');
  });

  it('disables the button with a distinct tooltip when geolocation is unavailable', () => {
    render(<LocateControl status="unavailable" onLocate={() => {}} />);
    const btn = screen.getByRole('button', { name: /locat/i });
    expect(btn.disabled).toBe(true);
    expect(btn.title).toBe('location is unavailable in this context');
  });

  it('uses distinct tooltips for denied versus unavailable (never conflated)', () => {
    const { unmount } = render(<LocateControl status="denied" onLocate={() => {}} />);
    const deniedTitle = screen.getByRole('button', { name: /locat/i }).title;
    unmount();
    render(<LocateControl status="unavailable" onLocate={() => {}} />);
    const unavailableTitle = screen.getByRole('button', { name: /locat/i }).title;
    expect(deniedTitle).not.toBe(unavailableTitle);
  });

  // Issue #114 / PRD #111 story 9 — in-progress feedback while acquiring the fix.
  it('shows an in-progress busy indicator while locating', () => {
    render(<LocateControl status="locating" onLocate={() => {}} />);
    const btn = screen.getByRole('button', { name: /locat/i });
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.className).toContain('locate-control--busy');
  });

  it('clears the in-progress indicator once a fix arrives', () => {
    render(<LocateControl status="success" onLocate={() => {}} />);
    const btn = screen.getByRole('button', { name: /locat/i });
    expect(btn.getAttribute('aria-busy')).toBe('false');
    expect(btn.className).not.toContain('locate-control--busy');
  });

  it('clears the in-progress indicator if the request is denied or unavailable', () => {
    for (const status of ['denied', 'unavailable', 'idle']) {
      const { unmount } = render(<LocateControl status={status} onLocate={() => {}} />);
      const btn = screen.getByRole('button', { name: /locat/i });
      expect(btn.getAttribute('aria-busy')).toBe('false');
      expect(btn.className).not.toContain('locate-control--busy');
      unmount();
    }
  });
});
