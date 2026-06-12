import { describe, it, expect } from 'vitest';
import {
  cameraPopupImageContent,
  cameraPopupErrorContent,
  cameraPopupLinkoutContent,
  cacheBustImageUrl,
} from './webcamPopup';

const SAMPLE_CAMERA = {
  id: 'trafikverket:tv-001',
  name: 'E4 Rotebro',
  type: 'traffic',
  media: 'image',
  lat: 59.47,
  lon: 17.95,
  imageUrl: 'https://example.test/cam/001.jpg',
  pageUrl: 'https://example.test/cam/001.html',
  source: 'trafikverket',
  attribution: 'Trafikverket',
  lastUpdated: '2026-06-11T12:00:00.000Z',
};

describe('cameraPopupImageContent', () => {
  it('renders an <img> with the camera image URL', () => {
    const html = cameraPopupImageContent(SAMPLE_CAMERA);
    expect(html).toContain('<img');
    expect(html).toContain('https://example.test/cam/001.jpg');
  });

  it('alt text includes the camera name (meaningful for screen readers)', () => {
    const html = cameraPopupImageContent(SAMPLE_CAMERA);
    expect(html).toMatch(/alt="[^"]*E4 Rotebro[^"]*"/);
  });

  it('renders the camera name, capture timestamp, and attribution', () => {
    const html = cameraPopupImageContent(SAMPLE_CAMERA);
    expect(html).toContain('E4 Rotebro');
    expect(html).toContain('Trafikverket');
    // Time may render in local format; we just assert it's not empty and
    // mentions 2026 from the lastUpdated field.
    expect(html).toMatch(/2026/);
  });

  it('includes a refresh affordance the wiring can find', () => {
    const html = cameraPopupImageContent(SAMPLE_CAMERA);
    expect(html).toMatch(/data-webcam-refresh/);
  });

  it('marks the <img> so the wiring can swap it on error / refresh', () => {
    const html = cameraPopupImageContent(SAMPLE_CAMERA);
    expect(html).toMatch(/data-webcam-image/);
  });

  it('attribution link points to the camera source page', () => {
    const html = cameraPopupImageContent(SAMPLE_CAMERA);
    expect(html).toMatch(/<a[^>]*href="https:\/\/example\.test\/cam\/001\.html"[^>]*>/);
  });

  it('caller can override imageUrl (for cache-busted refresh)', () => {
    const html = cameraPopupImageContent(SAMPLE_CAMERA, {
      imageUrl: 'https://example.test/cam/001.jpg?_t=999',
    });
    expect(html).toContain('https://example.test/cam/001.jpg?_t=999');
    // Original URL should NOT appear unescaped as the img src
    expect(html).not.toMatch(/src="https:\/\/example\.test\/cam\/001\.jpg"/);
  });

  it('escapes hostile name and attribution as inert text', () => {
    const hostile = {
      ...SAMPLE_CAMERA,
      name: '<script>alert(1)</script>',
      attribution: '"><img src=x onerror=alert(1)>',
    };
    const html = cameraPopupImageContent(hostile);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toMatch(/<img\s+src=x\s+onerror=/);
    expect(html).toContain('&lt;script&gt;');
  });

  it('drops javascript: pageUrl — attribution renders as text, not a link', () => {
    const hostile = { ...SAMPLE_CAMERA, pageUrl: 'javascript:alert(1)' };
    const html = cameraPopupImageContent(hostile);
    expect(html).not.toContain('javascript:');
    expect(html).not.toMatch(/<a[^>]*href/);
    expect(html).toContain('Trafikverket');
  });

  it('drops data: imageUrl — img src is emptied', () => {
    const hostile = { ...SAMPLE_CAMERA, imageUrl: 'data:text/html,<script>alert(1)</script>', pageUrl: 'https://example.test/cam/001.html' };
    const html = cameraPopupImageContent(hostile);
    expect(html).not.toContain('data:text/html');
    expect(html).toMatch(/src=""/);
  });

  it('keeps https URLs intact through the allowlist', () => {
    const html = cameraPopupImageContent(SAMPLE_CAMERA);
    expect(html).toMatch(/src="https:\/\/example\.test\/cam\/001\.jpg"/);
    expect(html).toMatch(/<a[^>]*href="https:\/\/example\.test\/cam\/001\.html"[^>]*>/);
  });
});

describe('cameraPopupErrorContent', () => {
  it('mentions the failure and links to the source page', () => {
    const html = cameraPopupErrorContent(SAMPLE_CAMERA);
    expect(html.toLowerCase()).toMatch(/could not|failed|error|unavailable/);
    expect(html).toMatch(/<a[^>]*href="https:\/\/example\.test\/cam\/001\.html"[^>]*>/);
  });

  it('does NOT include an <img> tag (placeholder only)', () => {
    const html = cameraPopupErrorContent(SAMPLE_CAMERA);
    expect(html).not.toContain('<img');
  });

  it('still shows the camera name and attribution', () => {
    const html = cameraPopupErrorContent(SAMPLE_CAMERA);
    expect(html).toContain('E4 Rotebro');
    expect(html).toContain('Trafikverket');
  });

  it('escapes hostile name', () => {
    const hostile = { ...SAMPLE_CAMERA, name: '<script>x</script>' };
    const html = cameraPopupErrorContent(hostile);
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('cameraPopupLinkoutContent', () => {
  const LINKOUT_CAMERA = {
    id: 'webcamcollections:fjallbacka',
    name: 'Fjällbacka',
    type: 'weather',
    media: 'linkout',
    lat: 58.60,
    lon: 11.28,
    imageUrl: null,
    pageUrl: 'https://webcamcollections.com/countries/sweden/fjallbacka',
    source: 'webcamcollections',
    attribution: 'webcamcollections.com',
    lastUpdated: null,
  };

  it('renders the camera name and attribution', () => {
    const html = cameraPopupLinkoutContent(LINKOUT_CAMERA);
    expect(html).toContain('Fjällbacka');
    expect(html).toContain('webcamcollections.com');
  });

  it('includes a "view at source" link pointing to the page URL', () => {
    const html = cameraPopupLinkoutContent(LINKOUT_CAMERA);
    expect(html.toLowerCase()).toMatch(/view at|view source|source|see at|open/);
    expect(html).toMatch(
      /<a[^>]*href="https:\/\/webcamcollections\.com\/countries\/sweden\/fjallbacka"[^>]*>/,
    );
  });

  it('source link uses rel="noopener noreferrer" target="_blank"', () => {
    const html = cameraPopupLinkoutContent(LINKOUT_CAMERA);
    expect(html).toMatch(/<a[^>]*target="_blank"[^>]*>/);
    expect(html).toMatch(/<a[^>]*rel="noopener noreferrer"[^>]*>/);
  });

  it('renders NO inline image and NO iframe / embed (ADR 0002)', () => {
    const html = cameraPopupLinkoutContent(LINKOUT_CAMERA);
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('<embed');
    expect(html).not.toContain('<video');
  });

  it('escapes hostile name and attribution as inert text', () => {
    const hostile = {
      ...LINKOUT_CAMERA,
      name: '<script>alert(1)</script>',
      attribution: '"><img src=x onerror=alert(1)>',
    };
    const html = cameraPopupLinkoutContent(hostile);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toMatch(/<img\s+src=x\s+onerror=/);
    expect(html).toContain('&lt;script&gt;');
  });

  it('drops javascript: pageUrl — no anchor is rendered', () => {
    const hostile = { ...LINKOUT_CAMERA, pageUrl: 'javascript:alert(1)' };
    const html = cameraPopupLinkoutContent(hostile);
    expect(html).not.toContain('javascript:');
    expect(html).not.toMatch(/<a[^>]*href/);
  });
});

describe('cacheBustImageUrl', () => {
  it('appends a cache-bust query parameter to a clean URL', () => {
    const url = cacheBustImageUrl('https://example.test/img.jpg', 12345);
    expect(url.startsWith('https://example.test/img.jpg?')).toBe(true);
    expect(url).toContain('12345');
  });

  it('uses & when URL already has a query string', () => {
    const url = cacheBustImageUrl('https://example.test/img.jpg?x=1', 12345);
    expect(url.startsWith('https://example.test/img.jpg?x=1&')).toBe(true);
    expect(url).toContain('12345');
  });

  it('produces different URLs for different tokens (refresh changes the URL)', () => {
    const a = cacheBustImageUrl('https://example.test/img.jpg', 1);
    const b = cacheBustImageUrl('https://example.test/img.jpg', 2);
    expect(a).not.toBe(b);
  });

  it('returns the original URL unchanged when input is falsy', () => {
    expect(cacheBustImageUrl('', 1)).toBe('');
    expect(cacheBustImageUrl(null, 1)).toBe(null);
  });
});
