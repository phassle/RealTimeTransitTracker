export const MODES = [
  { id: 'metro',   label: 'Metro', color: '#FF6B35', icon: 'M' },
  { id: 'bus',     label: 'Bus',   color: '#4ECDC4', icon: 'B' },
  { id: 'train',   label: 'Train', color: '#95E1D3', icon: 'T' },
  { id: 'tram',    label: 'Tram',  color: '#F38181', icon: 'S' },
  { id: 'ferry',   label: 'Ferry', color: '#FCBAD3', icon: '⛴' },
  // Aircraft modes come from the airplanes.live mapping, not GTFS — a mode no
  // longer implies a GTFS origin (PRD #165). They get mode filter buttons for
  // free and deliberately carry no GTFS route_type entry below.
  { id: 'aircraft',   label: 'Aircraft',   color: '#6EC1E4', icon: '✈' },
  { id: 'helicopter', label: 'Helicopter', color: '#B388FF', icon: '🚁' },
  { id: 'unknown', label: 'Other', color: '#888888', icon: '?' },
];

export const MODE_COLORS = Object.fromEntries(MODES.map(m => [m.id, m.color]));
export const MODE_ICONS  = Object.fromEntries(MODES.map(m => [m.id, m.icon]));
export const MODE_LABELS = Object.fromEntries(MODES.map(m => [m.id, m.label]));
export const ALL_MODE_IDS = MODES.map(m => m.id);

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
