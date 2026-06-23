import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { fetchVehiclePositions, fetchOperatorFeeds, resetTripMappingCache } from './trafiklab';

vi.mock('gtfs-realtime-bindings', () => ({
  default: {
    transit_realtime: {
      FeedMessage: {
        decode: vi.fn(),
      },
    },
  },
}));

const FIXTURE_ENTITY = {
  id: 'entity-1',
  vehicle: {
    vehicle: { id: 'bus-1', label: '542' },
    trip: { routeId: 'route-sl-1', tripId: 'trip-sl-1', directionId: 0 },
    position: { latitude: 59.3293, longitude: 18.0686, bearing: 90, speed: 10 },
    timestamp: 1686000000,
  },
};

const FIXTURE_FEED = {
  header: { timestamp: 1686000000 },
  entity: [FIXTURE_ENTITY],
};

const TRIP_MAPPING = {
  'trip-sl-1': { line: '542', routeType: 3 },
};

function makeOkFeedResponse() {
  return {
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8),
  };
}

describe('trafiklab — vehicle-feed module', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    GtfsRealtimeBindings.transit_realtime.FeedMessage.decode.mockReturnValue(FIXTURE_FEED);
    resetTripMappingCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('entity → Vehicle mapping', () => {
    it('maps a fixture GTFS entity to a Vehicle with all required fields', async () => {
      fetch.mockResolvedValueOnce(makeOkFeedResponse());
      const getTripMapping = vi.fn().mockResolvedValue(TRIP_MAPPING);

      const vehicles = await fetchVehiclePositions(['sl'], { apiKey: 'test-key', getTripMapping });

      expect(vehicles).toHaveLength(1);
      const v = vehicles[0];
      expect(v.id).toBe('sl:bus-1');
      expect(v.operator).toBe('sl');
      expect(v.latitude).toBeCloseTo(59.3293);
      expect(v.longitude).toBeCloseTo(18.0686);
      expect(v.bearing).toBe(90);
      expect(v.speed).toBe(10);
      expect(typeof v.timestamp).toBe('number');
      expect(v.direction).toBe(0);
    });

    it('enriches line from trip mapping', async () => {
      fetch.mockResolvedValueOnce(makeOkFeedResponse());
      const getTripMapping = vi.fn().mockResolvedValue(TRIP_MAPPING);

      const [v] = await fetchVehiclePositions(['sl'], { apiKey: 'test-key', getTripMapping });

      expect(v.line).toBe('542');
    });

    it('derives mode from routeType in trip mapping (routeType 3 → bus)', async () => {
      fetch.mockResolvedValueOnce(makeOkFeedResponse());
      const getTripMapping = vi.fn().mockResolvedValue(TRIP_MAPPING);

      const [v] = await fetchVehiclePositions(['sl'], { apiKey: 'test-key', getTripMapping });

      expect(v.mode).toBe('bus');
    });

    it('uses routeId as line fallback when trip has no entry in mapping', async () => {
      const entityNoMapping = {
        id: 'entity-2',
        vehicle: {
          vehicle: { id: 'bus-2' }, // no label — forces routeId fallback
          trip: { routeId: 'route-x', tripId: 'trip-unknown', directionId: 1 },
          position: { latitude: 59.3293, longitude: 18.0686, bearing: 0, speed: 0 },
          timestamp: 1686000000,
        },
      };
      GtfsRealtimeBindings.transit_realtime.FeedMessage.decode.mockReturnValue({
        header: { timestamp: 1686000000 },
        entity: [entityNoMapping],
      });
      fetch.mockResolvedValueOnce(makeOkFeedResponse());
      const getTripMapping = vi.fn().mockResolvedValue(TRIP_MAPPING);

      const [v] = await fetchVehiclePositions(['sl'], { apiKey: 'test-key', getTripMapping });

      expect(v.mode).toBe('unknown');
      expect(v.line).toBe('route-x');
    });
  });

  describe('missing trip mapping', () => {
    it('degrades gracefully when trip mapping is unavailable', async () => {
      fetch.mockResolvedValueOnce(makeOkFeedResponse());
      const getTripMapping = vi.fn().mockResolvedValue(null);

      const vehicles = await fetchVehiclePositions(['sl'], { apiKey: 'test-key', getTripMapping });

      expect(vehicles).toHaveLength(1);
      expect(vehicles[0].mode).toBe('unknown');
    });

    it('does not throw when trip mapping is unavailable', async () => {
      fetch.mockResolvedValueOnce(makeOkFeedResponse());
      const getTripMapping = vi.fn().mockResolvedValue(null);

      await expect(
        fetchVehiclePositions(['sl'], { apiKey: 'test-key', getTripMapping })
      ).resolves.toBeDefined();
    });
  });

  describe('per-operator failure isolation', () => {
    it('returns vehicles from healthy operator when one operator feed fails', async () => {
      // sl succeeds, ul fails
      fetch
        .mockResolvedValueOnce(makeOkFeedResponse())
        .mockRejectedValueOnce(new Error('feed down'));
      const getTripMapping = vi.fn().mockResolvedValue(TRIP_MAPPING);

      const vehicles = await fetchVehiclePositions(['sl', 'ul'], {
        apiKey: 'test-key',
        getTripMapping,
      });

      expect(vehicles).toHaveLength(1);
      expect(vehicles[0].operator).toBe('sl');
    });

    it('does not reject the whole fetch when one operator fails', async () => {
      fetch
        .mockResolvedValueOnce(makeOkFeedResponse())
        .mockRejectedValueOnce(new Error('feed down'));
      const getTripMapping = vi.fn().mockResolvedValue(TRIP_MAPPING);

      await expect(
        fetchVehiclePositions(['sl', 'ul'], { apiKey: 'test-key', getTripMapping })
      ).resolves.toBeDefined();
    });

    it('returns empty array when all operators fail', async () => {
      fetch
        .mockRejectedValueOnce(new Error('sl down'))
        .mockRejectedValueOnce(new Error('ul down'));
      const getTripMapping = vi.fn().mockResolvedValue(TRIP_MAPPING);

      const vehicles = await fetchVehiclePositions(['sl', 'ul'], {
        apiKey: 'test-key',
        getTripMapping,
      });

      expect(vehicles).toEqual([]);
    });
  });

  describe('fetchOperatorFeeds — per-operator fetch outcomes', () => {
    it('reports a healthy fetch outcome with vehicle count and data timestamp', async () => {
      fetch.mockResolvedValueOnce(makeOkFeedResponse());
      const getTripMapping = vi.fn().mockResolvedValue(TRIP_MAPPING);

      const { vehicles, outcomes } = await fetchOperatorFeeds(['sl'], {
        apiKey: 'test-key',
        getTripMapping,
      });

      expect(vehicles).toHaveLength(1);
      expect(outcomes).toHaveLength(1);
      expect(outcomes[0]).toEqual({
        operator: 'sl',
        ok: true,
        vehicleCount: 1,
        dataTimestamp: 1686000000,
      });
    });

    it('reports a failed outcome (ok:false) for an operator whose feed is down', async () => {
      fetch
        .mockResolvedValueOnce(makeOkFeedResponse())
        .mockRejectedValueOnce(new Error('feed down'));
      const getTripMapping = vi.fn().mockResolvedValue(TRIP_MAPPING);

      const { outcomes } = await fetchOperatorFeeds(['sl', 'ul'], {
        apiKey: 'test-key',
        getTripMapping,
      });

      const by = Object.fromEntries(outcomes.map((o) => [o.operator, o]));
      expect(by.sl.ok).toBe(true);
      expect(by.ul).toEqual({ operator: 'ul', ok: false, vehicleCount: 0, dataTimestamp: null });
    });
  });
});
