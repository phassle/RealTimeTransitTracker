// Webcams service — fetches Sweden's open webcams and normalizes them to the
// Camera model. Per-source failure isolation: an unreachable or malformed
// source yields zero cameras + a recorded error; the rest still render.
//
// Camera model (PRD #66):
//   { id, name, type, media, lat, lon, imageUrl, pageUrl,
//     source, attribution, lastUpdated }
//
// Sources wired up:
//   - Trafikverket (~450 traffic cameras, media:image)
//   - webcamcollections (curated hand-geocoded checked-in JSON, media:linkout)
//   - Windy (Sweden-filtered, media:linkout — terms do not permit static
//     previews outside their player, per the HITL ruling for issue #72)

import curatedDataset from '../../public/data/curated-cameras.json';
import { validateCuratedDataset } from './curatedCameras';

const TRAFIKVERKET_ENDPOINT = 'https://api.trafikinfo.trafikverket.se/v2/data.json';
const TRAFIKVERKET_ATTRIBUTION = 'Trafikverket';

const WINDY_ENDPOINT = 'https://api.windy.com/webcams/api/v3/webcams';
const WINDY_ATTRIBUTION = 'Windy.com';

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

// Windy Webcam API v3 — Sweden-filtered cameras, media:linkout.
// Windy's terms do not permit displaying static preview images outside their
// embedded player (HITL ruling, issue #72). Cameras are included as linkout:
// name + location + link to the Windy page; no image is fetched at view time.
// VITE_WINDY_API_KEY is optional; if absent the source silently yields zero
// cameras without surfacing an error.
export function normalizeWindyCamera(raw) {
  if (!raw) return null;
  const lat = raw.location?.latitude;
  const lon = raw.location?.longitude;
  if (lat == null || lon == null) return null;
  const parsedLat = parseFloat(lat);
  const parsedLon = parseFloat(lon);
  if (isNaN(parsedLat) || isNaN(parsedLon)) return null;
  return {
    id: `windy:${raw.webcamId}`,
    name: raw.title || '',
    type: 'weather',
    media: 'linkout',
    lat: parsedLat,
    lon: parsedLon,
    imageUrl: null,
    pageUrl: raw.urls?.detail || null,
    source: 'windy',
    attribution: WINDY_ATTRIBUTION,
    lastUpdated: raw.lastUpdatedOn || null,
  };
}

async function fetchWindyCameras() {
  const apiKey = import.meta.env?.VITE_WINDY_API_KEY;
  if (!apiKey) {
    return { cameras: [], error: null };
  }
  try {
    const response = await fetch(
      `${WINDY_ENDPOINT}?country=SE&limit=500&include=location,urls&lang=en`,
      { headers: { 'x-windy-api-key': apiKey } }
    );
    if (!response.ok) {
      return { cameras: [], error: `HTTP ${response.status}` };
    }
    const data = await response.json();
    const raw = data?.webcams;
    if (!Array.isArray(raw)) {
      return { cameras: [], error: 'malformed response' };
    }
    return {
      cameras: raw.map(normalizeWindyCamera).filter(Boolean),
      error: null,
    };
  } catch (e) {
    return { cameras: [], error: e?.message || String(e) };
  }
}

// Curated webcamcollections cameras are a checked-in JSON dataset; "fetch"
// here is a synchronous pass-through wrapped in a promise so it composes with
// the other source adapters. Validation runs once and a malformed dataset
// degrades to zero cameras + a recorded error (per-source isolation).
async function fetchCuratedCameras() {
  try {
    const validated = validateCuratedDataset(curatedDataset);
    return { cameras: validated, error: null };
  } catch (e) {
    return { cameras: [], error: e?.message || String(e) };
  }
}

const SOURCES = [
  { source: 'trafikverket', fetch: fetchTrafikverketCameras },
  { source: 'webcamcollections', fetch: fetchCuratedCameras },
  { source: 'windy', fetch: fetchWindyCameras },
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
