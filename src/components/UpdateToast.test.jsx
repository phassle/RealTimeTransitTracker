import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateToast } from './UpdateToast';

describe('UpdateToast', () => {
  it('renders toast when update is waiting', () => {
    render(<UpdateToast isVisible={true} onReload={() => {}} onDismiss={() => {}} />);
    expect(screen.getByText(/new version available/i)).toBeDefined();
  });

  it('renders nothing when no update is waiting', () => {
    const { container } = render(<UpdateToast isVisible={false} onReload={() => {}} onDismiss={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onReload when reload button is clicked', () => {
    const onReload = vi.fn();
    render(<UpdateToast isVisible={true} onReload={onReload} onDismiss={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /reload/i }));
    expect(onReload).toHaveBeenCalledOnce();
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    render(<UpdateToast isVisible={true} onReload={() => {}} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('has update-toast class for styling', () => {
    render(<UpdateToast isVisible={true} onReload={() => {}} onDismiss={() => {}} />);
    expect(document.querySelector('.update-toast')).toBeTruthy();
  });
});
