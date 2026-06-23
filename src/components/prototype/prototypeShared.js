// PROTOTYPE — throwaway. Shared helpers for the fancy ControlPanel variants.
// Answers: "what should a fancier interface look like?" (sub-shape A, ?variant=).
// Delete this whole prototype/ folder once a variant wins. See NOTES.md.
import { MODE_LABELS } from '../../services/modes';

/** Count vehicles per mode. */
export function countByMode(vehicles = []) {
  return vehicles.reduce((acc, v) => {
    acc[v.mode] = (acc[v.mode] || 0) + 1;
    return acc;
  }, {});
}

/** Filter the available-lines map by a free-text query (line number or mode name). */
export function filterLines(availableLines = {}, query = '') {
  const q = query.trim().toLowerCase();
  if (!q) return availableLines;
  const out = {};
  for (const [mode, lines] of Object.entries(availableLines)) {
    const modeLabel = (MODE_LABELS[mode] || mode).toLowerCase();
    const matching = lines.filter(
      ({ line }) => line.toLowerCase().includes(q) || modeLabel.includes(q),
    );
    if (matching.length > 0) out[mode] = matching;
  }
  return out;
}
