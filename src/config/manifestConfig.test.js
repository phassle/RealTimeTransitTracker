import { describe, it, expect } from 'vitest';
import {
  MANIFEST_NAME,
  MANIFEST_SHORT_NAME,
  MANIFEST_DISPLAY,
  MANIFEST_START_URL,
  MANIFEST_THEME_COLOR_LIGHT,
  MANIFEST_THEME_COLOR_DARK,
  MANIFEST_BACKGROUND_COLOR,
  manifestIcons,
  manifestConfig,
} from './manifestConfig';

describe('manifestConfig', () => {
  describe('MANIFEST_NAME', () => {
    it('is the full app name', () => {
      expect(MANIFEST_NAME).toBe('Sweden Real-Time Transit Map');
    });
  });

  describe('MANIFEST_SHORT_NAME', () => {
    it('is the short app name', () => {
      expect(MANIFEST_SHORT_NAME).toBe('Transit Map');
    });
  });

  describe('MANIFEST_DISPLAY', () => {
    it('is standalone for full-screen launch', () => {
      expect(MANIFEST_DISPLAY).toBe('standalone');
    });
  });

  describe('MANIFEST_START_URL', () => {
    it('is the root path', () => {
      expect(MANIFEST_START_URL).toBe('/');
    });
  });

  describe('MANIFEST_THEME_COLOR_LIGHT', () => {
    it('is a valid hex colour string', () => {
      expect(MANIFEST_THEME_COLOR_LIGHT).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  describe('MANIFEST_THEME_COLOR_DARK', () => {
    it('is a valid hex colour string', () => {
      expect(MANIFEST_THEME_COLOR_DARK).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('is different from the light theme colour', () => {
      expect(MANIFEST_THEME_COLOR_DARK).not.toBe(MANIFEST_THEME_COLOR_LIGHT);
    });
  });

  describe('MANIFEST_BACKGROUND_COLOR', () => {
    it('is a valid hex colour string', () => {
      expect(MANIFEST_BACKGROUND_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  describe('manifestIcons', () => {
    it('includes a 192x192 standard icon', () => {
      const icon = manifestIcons.find(i => i.sizes === '192x192' && !i.purpose?.includes('maskable'));
      expect(icon).toBeDefined();
      expect(icon.type).toBe('image/png');
    });

    it('includes a 512x512 standard icon', () => {
      const icon = manifestIcons.find(i => i.sizes === '512x512' && !i.purpose?.includes('maskable'));
      expect(icon).toBeDefined();
      expect(icon.type).toBe('image/png');
    });

    it('includes a maskable icon', () => {
      const icon = manifestIcons.find(i => i.purpose?.includes('maskable'));
      expect(icon).toBeDefined();
      expect(icon.type).toBe('image/png');
    });

    it('all icons have src, sizes, and type', () => {
      manifestIcons.forEach(icon => {
        expect(icon.src).toBeTruthy();
        expect(icon.sizes).toBeTruthy();
        expect(icon.type).toBe('image/png');
      });
    });

    it('icon src paths start with /icons/', () => {
      manifestIcons.forEach(icon => {
        expect(icon.src).toMatch(/^\/icons\//);
      });
    });
  });

  describe('manifestConfig', () => {
    it('has the correct name', () => {
      expect(manifestConfig.name).toBe(MANIFEST_NAME);
    });

    it('has the correct short_name', () => {
      expect(manifestConfig.short_name).toBe(MANIFEST_SHORT_NAME);
    });

    it('has standalone display', () => {
      expect(manifestConfig.display).toBe(MANIFEST_DISPLAY);
    });

    it('has root start_url', () => {
      expect(manifestConfig.start_url).toBe(MANIFEST_START_URL);
    });

    it('uses the light theme colour', () => {
      expect(manifestConfig.theme_color).toBe(MANIFEST_THEME_COLOR_LIGHT);
    });

    it('has icons array matching manifestIcons', () => {
      expect(manifestConfig.icons).toBe(manifestIcons);
    });
  });
});
