import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScenarioBanner } from './ScenarioBanner';

describe('ScenarioBanner', () => {
  it('renders nothing when no scenario is active', () => {
    const { container } = render(<ScenarioBanner scenario={null} onExit={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows a persistent what-if status banner naming the scenario', () => {
    const scenario = { id: 's1', name: 'close Slussen', source: 'preset', demo: true };
    render(<ScenarioBanner scenario={scenario} onExit={() => {}} />);
    const banner = screen.getByRole('status');
    expect(banner.textContent).toMatch(/what-if|scenario|hypothesis/i);
    expect(banner.textContent).toMatch(/close Slussen/);
  });

  it('offers a one-click exit that retracts the scenario', () => {
    const onExit = vi.fn();
    const scenario = { id: 's1', name: 'close Slussen', source: 'preset', demo: true };
    render(<ScenarioBanner scenario={scenario} onExit={onExit} />);
    fireEvent.click(screen.getByRole('button', { name: /exit|return to live/i }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
