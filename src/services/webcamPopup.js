// Webcam popup presentation module — pure functions mapping a Camera to
// popup markup. Testable without Leaflet; rendered by Map.jsx via Leaflet
// `bindPopup`. All externally-sourced strings are HTML-escaped, consistent
// with the vehicle popup escaping.
//
// Per ADR 0004: image media renders exclusively as a hotlinked static
// <img>. No iframes, players, or source-controlled script.

import { escapeHtml } from './markerCollection';

function formatCaptureTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('sv-SE');
  } catch {
    return String(iso);
  }
}

/**
 * Append a cache-busting query parameter so a refresh request differs from
 * the previous URL — fixes the "browser served the cached image" trap.
 * Returns falsy input unchanged so callers don't have to guard.
 */
export function cacheBustImageUrl(url, token) {
  if (!url) return url;
  const sep = String(url).includes('?') ? '&' : '?';
  return `${url}${sep}_t=${token}`;
}

/**
 * Image-variant popup: latest still + name + capture timestamp + refresh
 * button + attribution link. The image carries `data-webcam-image` and the
 * refresh button carries `data-webcam-refresh` so the Map.jsx wiring can
 * find them after Leaflet inserts the popup into the DOM.
 *
 * @param {object} camera
 * @param {{ imageUrl?: string }} [options]  imageUrl override (used to pass
 *   a cache-busted URL on refresh without mutating the Camera).
 */
export function cameraPopupImageContent(camera, options = {}) {
  const src = options.imageUrl ?? camera.imageUrl ?? '';
  const altText = camera.name ? `Webcam: ${camera.name}` : 'Webcam';
  const time = formatCaptureTime(camera.lastUpdated);
  const pageUrl = camera.pageUrl || camera.imageUrl || '';

  return `
    <div class="webcam-popup" style="font-family: sans-serif; min-width: 220px; max-width: 320px;">
      <img
        data-webcam-image
        src="${escapeHtml(src)}"
        alt="${escapeHtml(altText)}"
        style="display: block; width: 100%; height: auto; max-height: 220px; object-fit: cover; background: #eee;"
      />
      <div style="padding: 6px 2px 0;">
        <strong style="font-size: 14px;">${escapeHtml(camera.name || '')}</strong>
        ${time ? `<div style="color: #666; font-size: 12px; margin-top: 2px;">${escapeHtml(time)}</div>` : ''}
        <div style="margin-top: 6px; display: flex; gap: 8px; align-items: center; justify-content: space-between;">
          <button
            type="button"
            data-webcam-refresh
            style="font-size: 12px; padding: 4px 8px; cursor: pointer;"
          >Refresh</button>
          <a
            href="${escapeHtml(pageUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            style="font-size: 12px; color: #2c3e50;"
          >${escapeHtml(camera.attribution || 'Source')}</a>
        </div>
      </div>
    </div>
  `;
}

/**
 * Linkout-variant popup: metadata + a "view at source" link, NO inline media.
 *
 * Curated webcamcollections cameras fetch nothing from third parties — per
 * ADR 0004 the app only links. Renders the camera name, attribution, and a
 * link to the source page; no <img>, no <iframe>, no embed.
 */
export function cameraPopupLinkoutContent(camera) {
  const pageUrl = camera.pageUrl || '';
  const attribution = camera.attribution || 'source';
  return `
    <div class="webcam-popup webcam-popup--linkout" style="font-family: sans-serif; min-width: 220px; max-width: 320px;">
      <div style="padding: 4px 2px 0;">
        <strong style="font-size: 14px;">${escapeHtml(camera.name || '')}</strong>
        <div style="color: #666; font-size: 12px; margin-top: 2px;">
          ${escapeHtml(attribution)}
        </div>
        <div style="margin-top: 8px;">
          <a
            href="${escapeHtml(pageUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            style="font-size: 13px; color: #2c3e50; font-weight: 600;"
          >View at source ↗</a>
        </div>
      </div>
    </div>
  `;
}

/**
 * Error placeholder — shown when the hotlinked image fails to load. Keeps
 * the popup useful (name + source link) instead of looking like the app
 * is broken.
 */
export function cameraPopupErrorContent(camera) {
  const pageUrl = camera.pageUrl || camera.imageUrl || '';
  return `
    <div class="webcam-popup webcam-popup--error" style="font-family: sans-serif; min-width: 220px; max-width: 320px;">
      <div style="padding: 12px; background: #f7f1d8; border: 1px dashed #c9b87a; color: #5a4d1f; font-size: 13px;">
        Image could not be loaded.
      </div>
      <div style="padding: 6px 2px 0;">
        <strong style="font-size: 14px;">${escapeHtml(camera.name || '')}</strong>
        <div style="margin-top: 6px;">
          <a
            href="${escapeHtml(pageUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            style="font-size: 12px; color: #2c3e50;"
          >View at ${escapeHtml(camera.attribution || 'source')}</a>
        </div>
      </div>
    </div>
  `;
}
