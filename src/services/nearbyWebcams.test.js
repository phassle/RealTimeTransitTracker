import { describe, it, expect } from 'vitest';
import { nearbyWebcams, WEBCAM_DISTANCE_BOUND_M } from './nearbyWebcams';

// Stockholm-ish subject.
const SUBJECT = { kind: 'geographic', latitude: 59.3293, longitude: 18.0686 };

function cam(overrides = {}) {
  return {
    id: 'cam-1',
    name: 'Cam',
    type: 'weather',
    media: 'linkout',
    lat: 59.3293,
    lon: 18.0686,
    imageUrl: null,
    pageUrl: 'https://example.com/cam',
    source: 's',
    attribution: 'a',
    lastUpdated: null,
    ...overrides,
  };
}

// ~111m per 0.001° latitude near Stockholm, so offsets translate to roughly
// known metre distances for the bound assertions.
function latOffset(meters) {
  return meters / 111000;
}

describe('nearbyWebcams', () => {
  it('returns webcams within the distance bound, excluding distant ones', () => {
    const near = cam({ id: 'near', lat: SUBJECT.latitude + latOffset(500), lon: SUBJECT.longitude });
    const far = cam({ id: 'far', lat: SUBJECT.latitude + latOffset(WEBCAM_DISTANCE_BOUND_M + 5000), lon: SUBJECT.longitude });

    const result = nearbyWebcams(SUBJECT, [near, far]);

    expect(result.map((c) => c.id)).toEqual(['near']);
  });

  it('ranks traffic cameras first, then by ascending distance', () => {
    const trafficFar = cam({ id: 'traffic-far', type: 'traffic', lat: SUBJECT.latitude + latOffset(3000), lon: SUBJECT.longitude });
    const trafficNear = cam({ id: 'traffic-near', type: 'traffic', lat: SUBJECT.latitude + latOffset(1000), lon: SUBJECT.longitude });
    const weatherNear = cam({ id: 'weather-near', type: 'weather', lat: SUBJECT.latitude + latOffset(200), lon: SUBJECT.longitude });

    const result = nearbyWebcams(SUBJECT, [weatherNear, trafficFar, trafficNear]);

    // Both traffic cameras outrank the closer weather camera; within traffic,
    // the nearer one comes first.
    expect(result.map((c) => c.id)).toEqual(['traffic-near', 'traffic-far', 'weather-near']);
  });

  it('annotates each result with its distance in metres', () => {
    const c = cam({ lat: SUBJECT.latitude + latOffset(500), lon: SUBJECT.longitude });
    const [result] = nearbyWebcams(SUBJECT, [c]);
    expect(result.distanceM).toBeGreaterThan(400);
    expect(result.distanceM).toBeLessThan(600);
  });

  it('returns an empty list for a non-geographic (operator) subject', () => {
    const operatorSubject = { kind: 'operator', operator: 'sl' };
    expect(nearbyWebcams(operatorSubject, [cam()])).toEqual([]);
  });

  it('returns an empty list for a null subject or empty camera list', () => {
    expect(nearbyWebcams(null, [cam()])).toEqual([]);
    expect(nearbyWebcams(SUBJECT, [])).toEqual([]);
    expect(nearbyWebcams(SUBJECT, null)).toEqual([]);
  });

  it('skips cameras without coordinates', () => {
    const noCoords = cam({ id: 'no-coords', lat: null, lon: undefined });
    expect(nearbyWebcams(SUBJECT, [noCoords])).toEqual([]);
  });
});
