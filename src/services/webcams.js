// Webcams service — fetches Sweden's open webcams and normalizes them to the
// Camera model. Per-source failure isolation: an unreachable or malformed
// source yields zero cameras + a recorded error; the rest still render.
//
// Camera model (PRD #66):
//   { id, name, type, media, lat, lon, imageUrl, pageUrl,
//     source, attribution, lastUpdated }
//
// In this slice only Trafikverket is wired up. Windy and the curated
// linkout dataset land in later slices.

const TRAFIKVERKET_ENDPOINT = 'https://api.trafikinfo.trafikverket.se/v2/data.json';
const TRAFIKVERKET_ATTRIBUTION = 'Trafikverket';

function trafikverketQuery(key) {
  return (
    `<REQUEST>` +
    `<LOGIN authenticationkey="${key}"/>` +
    `<QUERY objecttype="Camera" schemaversion="1">` +
    `<FILTER><EQ name="Active" value="true"/></FILTER>` +
    `</QUERY>` +
    `</REQUEST>`
  );
}

// Trafikverket returns "POINT (lon lat)" (WKT). Returns null if unparseable.
function parseWgs84Point(wkt) {
  if (typeof wkt !== 'string') return null;
  const m = /POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/.exec(wkt);
  if (!m) return null;
  return { lon: parseFloat(m[1]), lat: parseFloat(m[2]) };
}

// PRD #66 expects all Trafikverket cameras to be `traffic`. The mapping is
// kept as a function so unexpected Type values from the live data can be
// routed without changing the caller.
function mapTrafikverketType(/* rawType */) {
  return 'traffic';
}

export function normalizeTrafikverketCamera(raw) {
  if (!raw) return null;
  const coords = parseWgs84Point(raw.Geometry?.WGS84);
  if (!coords) return null;
  return {
    id: `trafikverket:${raw.Id}`,
    name: raw.Name || '',
    type: mapTrafikverketType(raw.Type),
    media: 'image',
    lat: coords.lat,
    lon: coords.lon,
    imageUrl: raw.PhotoUrl || null,
    pageUrl: raw.PhotoUrl || null,
    source: 'trafikverket',
    attribution: TRAFIKVERKET_ATTRIBUTION,
    lastUpdated: raw.PhotoTime || null,
  };
}

async function fetchTrafikverketCameras() {
  const apiKey = import.meta.env?.VITE_TRAFIKVERKET_API_KEY;
  if (!apiKey) {
    return { cameras: [], error: 'missing VITE_TRAFIKVERKET_API_KEY' };
  }
  try {
    const response = await fetch(TRAFIKVERKET_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: trafikverketQuery(apiKey),
    });
    if (!response.ok) {
      return { cameras: [], error: `HTTP ${response.status}` };
    }
    const data = await response.json();
    const raw = data?.RESPONSE?.RESULT?.[0]?.Camera;
    if (!Array.isArray(raw)) {
      return { cameras: [], error: 'malformed response' };
    }
    return {
      cameras: raw.map(normalizeTrafikverketCamera).filter(Boolean),
      error: null,
    };
  } catch (e) {
    return { cameras: [], error: e?.message || String(e) };
  }
}

const SOURCES = [
  { source: 'trafikverket', fetch: fetchTrafikverketCameras },
];

/**
 * Fetch the combined webcam list.
 *
 * @returns {Promise<{
 *   cameras: Array<object>,
 *   errors: Array<{ source: string, message: string }>
 * }>}
 */
export async function fetchCameras() {
  const results = await Promise.all(SOURCES.map(s => s.fetch()));
  const cameras = [];
  const errors = [];
  results.forEach((result, i) => {
    cameras.push(...result.cameras);
    if (result.error) {
      errors.push({ source: SOURCES[i].source, message: result.error });
    }
  });
  return { cameras, errors };
}
