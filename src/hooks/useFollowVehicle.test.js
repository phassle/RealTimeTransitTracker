import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFollowVehicle } from './useFollowVehicle';

function vehicle(id, latitude, longitude, overrides = {}) {
  return { id, latitude, longitude, mode: 'bus', line: '17', ...overrides };
}

describe('useFollowVehicle', () => {
  it('resolves the followed vehicle position from the live list', () => {
    const list = [vehicle('a', 59.3, 18.0), vehicle('b', 60.1, 17.5)];
    const { result } = renderHook(() =>
      useFollowVehicle({ vehicles: list, selectedVehicleId: 'b', followMode: true }),
    );
    expect(result.current.followedPosition).toEqual([60.1, 17.5]);
  });

  it('tracks the followed vehicle to its new position on each update', () => {
    const { result, rerender } = renderHook(
      ({ vehicles }) =>
        useFollowVehicle({ vehicles, selectedVehicleId: 'b', followMode: true }),
      { initialProps: { vehicles: [vehicle('b', 60.1, 17.5)] } },
    );
    expect(result.current.followedPosition).toEqual([60.1, 17.5]);

    rerender({ vehicles: [vehicle('b', 60.2, 17.6)] });
    expect(result.current.followedPosition).toEqual([60.2, 17.6]);
  });

  it('does nothing when followMode is off', () => {
    const onExit = vi.fn();
    const { result } = renderHook(() =>
      useFollowVehicle({
        vehicles: [vehicle('b', 60.1, 17.5)],
        selectedVehicleId: 'b',
        followMode: false,
        onExit,
      }),
    );
    expect(result.current.followedPosition).toBeNull();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('emits the exit signal when the followed vehicle leaves the feed', () => {
    const onExit = vi.fn();
    const { rerender } = renderHook(
      ({ vehicles }) =>
        useFollowVehicle({ vehicles, selectedVehicleId: 'b', followMode: true, onExit }),
      { initialProps: { vehicles: [vehicle('b', 60.1, 17.5)] } },
    );
    expect(onExit).not.toHaveBeenCalled();

    rerender({ vehicles: [vehicle('a', 59.3, 18.0)] });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('does not emit the exit signal when not following', () => {
    const onExit = vi.fn();
    renderHook(() =>
      useFollowVehicle({
        vehicles: [vehicle('a', 59.3, 18.0)],
        selectedVehicleId: 'b',
        followMode: false,
        onExit,
      }),
    );
    expect(onExit).not.toHaveBeenCalled();
  });

  it('exposes no position when following an id that is not in the feed', () => {
    const { result } = renderHook(() =>
      useFollowVehicle({
        vehicles: [vehicle('a', 59.3, 18.0)],
        selectedVehicleId: 'b',
        followMode: true,
      }),
    );
    expect(result.current.followedPosition).toBeNull();
  });

  it('emits exit only once while the vehicle remains absent', () => {
    const onExit = vi.fn();
    const { rerender } = renderHook(
      ({ vehicles }) =>
        useFollowVehicle({ vehicles, selectedVehicleId: 'b', followMode: true, onExit }),
      { initialProps: { vehicles: [vehicle('b', 60.1, 17.5)] } },
    );
    rerender({ vehicles: [vehicle('a', 59.3, 18.0)] });
    rerender({ vehicles: [vehicle('a', 59.3, 18.1)] });
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
