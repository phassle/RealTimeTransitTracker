// `icon` is a vehicle-TYPE pictogram, shown on the marker so each Vehicle reads
// as its type at a glance (a plane looks like a plane, a bus like a bus) rather
// than as a coloured dot. Colour still encodes the mode for quick scanning.
export const MODES = [
  { id: 'metro',   label: 'Metro', color: '#FF6B35', icon: '🚇' },
  { id: 'bus',     label: 'Bus',   color: '#4ECDC4', icon: '🚌' },
  { id: 'train',   label: 'Train', color: '#95E1D3', icon: '🚆' },
  { id: 'tram',    label: 'Tram',  color: '#F38181', icon: '🚊' },
  { id: 'ferry',   label: 'Ferry', color: '#FCBAD3', icon: '⛴' },
  // Non-GTFS modes — aircraft come from airplanes.live, not a GTFS route_type.
  { id: 'aircraft',   label: 'Aircraft',   color: '#A29BFE', icon: '✈' },
  { id: 'helicopter', label: 'Helicopter', color: '#74B9FF', icon: '🚁' },
  { id: 'unknown', label: 'Other', color: '#888888', icon: '?' },
];

export const MODE_COLORS = Object.fromEntries(MODES.map(m => [m.id, m.color]));
export const MODE_ICONS  = Object.fromEntries(MODES.map(m => [m.id, m.icon]));
export const MODE_LABELS = Object.fromEntries(MODES.map(m => [m.id, m.label]));
export const ALL_MODE_IDS = MODES.map(m => m.id);

// The non-transit modes: aircraft come from airplanes.live, not a GTFS feed, and
// a callsign is not a Line (CONTEXT.md). Single source of truth for "this Vehicle
// is an Aircraft" — used to keep aircraft out of transit-only surfaces (the line
// selector lists transit lines only; PRD #165, issue #169). Aircraft stay
// filterable by mode.
export const AIRCRAFT_MODE_IDS = new Set(['aircraft', 'helicopter']);

export const GTFS_ROUTE_TYPE_TO_MODE = {
  '0':    'tram',
  '1':    'metro',
  '2':    'train',
  '3':    'bus',
  '4':    'ferry',
  '5':    'tram',
  '6':    'tram',
  '7':    'tram',
  '100':  'train',
  '101':  'train',
  '102':  'train',
  '109':  'train',
  '400':  'metro',
  '401':  'metro',
  '700':  'bus',
  '714':  'bus',
  '900':  'tram',
  '1000': 'ferry',
  '1501': 'bus',
};

export function routeTypeToMode(routeType) {
  return GTFS_ROUTE_TYPE_TO_MODE[String(routeType)] ?? 'unknown';
}
