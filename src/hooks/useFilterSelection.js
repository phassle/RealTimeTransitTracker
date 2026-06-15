import { useState, useMemo } from 'react';
import { ALL_MODE_IDS } from '../services/modes';

export function useFilterSelection(allVehicles) {
  const [enabledModes, setEnabledModes] = useState(ALL_MODE_IDS);
  // Private: Set of "mode:line" keys — never exposed as strings
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  // Private: Set of "mode:line" keys for Favourites — orthogonal to Selection,
  // in-memory only this slice (persistence arrives in a later slice). Favourites
  // survive a mode being disabled, so toggleMode never touches this set.
  const [favouriteKeys, setFavouriteKeys] = useState(() => new Set());

  const toggleMode = (mode) => {
    setEnabledModes(prev => {
      const disabling = prev.includes(mode);
      if (disabling) {
        setSelectedKeys(keys => {
          const prefix = `${mode}:`;
          const next = new Set(keys);
          for (const key of next) {
            if (key.startsWith(prefix)) next.delete(key);
          }
          return next;
        });
      }
      return disabling ? prev.filter(m => m !== mode) : [...prev, mode];
    });
  };

  const toggleLine = (mode, line) => {
    if (!enabledModes.includes(mode)) return;
    const key = `${mode}:${line}`;
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const clearLines = () => {
    setSelectedKeys(new Set());
  };

  const isLineSelected = (mode, line) => selectedKeys.has(`${mode}:${line}`);

  const toggleFavourite = (mode, line) => {
    const key = `${mode}:${line}`;
    setFavouriteKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const isLineFavourite = (mode, line) => favouriteKeys.has(`${mode}:${line}`);

  const vehicles = Array.isArray(allVehicles) ? allVehicles : [];

  // {mode, line}[] — no key strings cross the interface
  const selectedLines = useMemo(() => {
    return Array.from(selectedKeys).map(key => {
      const idx = key.indexOf(':');
      return { mode: key.slice(0, idx), line: key.slice(idx + 1) };
    });
  }, [selectedKeys]);

  const availableLines = useMemo(() => {
    const groups = {};
    for (const vehicle of vehicles) {
      if (!enabledModes.includes(vehicle.mode) || !vehicle.line) continue;
      if (!groups[vehicle.mode]) groups[vehicle.mode] = {};
      groups[vehicle.mode][vehicle.line] = (groups[vehicle.mode][vehicle.line] || 0) + 1;
    }
    const sorted = {};
    for (const mode of Object.keys(groups).sort()) {
      sorted[mode] = Object.entries(groups[mode])
        .sort(([a], [b]) => {
          const na = parseInt(a, 10);
          const nb = parseInt(b, 10);
          if (!isNaN(na) && !isNaN(nb)) return na - nb;
          return a.localeCompare(b);
        })
        .map(([line, count]) => ({ line, count }));
    }
    return sorted;
  }, [vehicles, enabledModes]);

  const filteredVehicles = useMemo(() => {
    let filtered = vehicles.filter(vehicle => enabledModes.includes(vehicle.mode));
    if (selectedKeys.size > 0) {
      filtered = filtered.filter(vehicle => selectedKeys.has(`${vehicle.mode}:${vehicle.line}`));
    }
    return filtered;
  }, [vehicles, enabledModes, selectedKeys]);

  return {
    enabledModes,
    toggleMode,
    selectedLines,
    isLineSelected,
    toggleLine,
    clearLines,
    isLineFavourite,
    toggleFavourite,
    availableLines,
    filteredVehicles,
  };
}
