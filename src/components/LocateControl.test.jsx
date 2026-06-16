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
});
