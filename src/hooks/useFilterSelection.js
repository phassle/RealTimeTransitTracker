import { useState, useMemo } from 'react';
import { ALL_MODE_IDS } from '../services/modes';

// Favourites are Essential storage (ADR 0001) — a record of the user's own UI
// choice, like theme. Versioned key lets a future shape change re-initialise
// cleanly. Value is a JSON array of {mode, line} records; internally we hold a
// Set of "mode:line" keys, so read/write convert between the two shapes.
const FAVOURITES_STORAGE_KEY = 'rtt-favourite-lines-v1';

// Read defensively: a non-array or unparseable value yields an empty set;
// entries are filtered to a valid {mode, line} shape and de-duplicated (the Set
// dedupes), so one corrupt record neither wipes everything nor crashes.
function readFavouriteKeys() {
  try {
    const raw = window.localStorage.getItem(FAVOURITES_STORAGE_KEY);
    if (raw == null) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const keys = new Set();
    for (const entry of parsed) {
      if (entry && typeof entry.mode === 'string' && entry.mode
          && typeof entry.line === 'string' && entry.line) {
        keys.add(`${entry.mode}:${entry.line}`);
      }
    }
    return keys;
  } catch {
    // unparseable / private mode — degrade silently to no favourites
    return new Set();
  }
}

function writeFavouriteKeys(keys) {
  try {
    const records = Array.from(keys).map(key => {
      const idx = key.indexOf(':');
      return { mode: key.slice(0, idx), line: key.slice(idx + 1) };
    });
    window.localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // private mode / quota — degrade silently; favourites won't persist
  }
}

export function useFilterSelection(allVehicles) {
  const [enabledModes, setEnabledModes] = useState(ALL_MODE_IDS);
  // Private: Set of "mode:line" keys for Favourites — orthogonal to Selection.
  // Restored from versioned localStorage on mount and write-through on toggle.
  // Favourites survive a mode being disabled, so toggleMode never touches this.
  const [favouriteKeys, setFavouriteKeys] = useState(readFavouriteKeys);
  // Private: Set of "mode:line" keys — never exposed as strings. Seeded from the
  // persisted Favourites once on mount (the lazy init runs only on first render),
  // so a returning user's pins are pre-selected. Seeding is a one-time
  // initialisation, not a continuous binding: deselecting a seeded line this
  // session does not unfavourite it and does not re-seed; the next fresh mount
  // reads the Favourites again and re-seeds. Seeding does not depend on a live
  // vehicle, so a Favourite with no vehicles still shows as a selected chip.
  const [selectedKeys, setSelectedKeys] = useState(() => new Set(favouriteKeys));

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
    const next = new Set(favouriteKeys);
    if (next.has(key)) next.delete(key); else next.add(key);
    writeFavouriteKeys(next); // write-through: persist before any further action
    setFavouriteKeys(next);
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
