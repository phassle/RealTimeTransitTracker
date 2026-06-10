import { describe, it, expect } from 'vitest';
import { tileLayerConfig } from './tileLayerConfig';

describe('tileLayerConfig', () => {
  it('light theme returns OpenStreetMap URL', () => {
    const config = tileLayerConfig('light');
    expect(config.url).toBe('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
  });

  it('light theme attribution credits OpenStreetMap and Trafiklab', () => {
    const config = tileLayerConfig('light');
    expect(config.attribution).toContain('OpenStreetMap');
    expect(config.attribution).toContain('Trafiklab');
  });

  it('dark theme returns CartoDB Dark Matter URL', () => {
    const config = tileLayerConfig('dark');
    expect(config.url).toBe('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');
  });

  it('dark theme attribution credits OpenStreetMap and CARTO', () => {
    const config = tileLayerConfig('dark');
    expect(config.attribution).toContain('OpenStreetMap');
    expect(config.attribution).toContain('CARTO');
  });

  it('returns an object with url and attribution for light', () => {
    const config = tileLayerConfig('light');
    expect(typeof config.url).toBe('string');
    expect(typeof config.attribution).toBe('string');
  });

  it('returns an object with url and attribution for dark', () => {
    const config = tileLayerConfig('dark');
    expect(typeof config.url).toBe('string');
    expect(typeof config.attribution).toBe('string');
  });

  it('unknown theme falls back to light config', () => {
    const light = tileLayerConfig('light');
    const fallback = tileLayerConfig('other');
    expect(fallback.url).toBe(light.url);
    expect(fallback.attribution).toBe(light.attribution);
  });
});
