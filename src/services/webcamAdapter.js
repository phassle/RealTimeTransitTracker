import L from 'leaflet';
import { CAMERA_TYPE_DEFINITIONS } from './cameraTypeFilter';
import {
  cameraPopupImageContent,
  cameraPopupErrorContent,
  cameraPopupLinkoutContent,
  cacheBustImageUrl,
} from './webcamPopup';
import { escapeHtml } from './markerCollection';

const CAMERA_TYPE_COLOR = Object.fromEntries(
  CAMERA_TYPE_DEFINITIONS.map(t => [t.id, t.color])
);
const CAMERA_DEFAULT_COLOR = '#2c3e50';

/**
 * Wire the interactive bits of a camera image popup after Leaflet has inserted
 * it into the DOM:
 *   <img onerror>     → swap to error placeholder
 *   refresh button    → re-render with cache-busted image URL, then re-wire
 *
 * Exported so it can be tested independently of the full adapter.
 */
export function wireCameraPopup(popup, camera) {
  const root = popup.getElement();
  if (!root) return;
  const img = root.querySelector('[data-webcam-image]');
  const btn = root.querySelector('[data-webcam-refresh]');

  if (img) {
    img.addEventListener('error', () => {
      popup.setContent(cameraPopupErrorContent(camera));
    }, { once: true });
  }

  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const fresh = cacheBustImageUrl(camera.imageUrl, Date.now());
      popup.setContent(cameraPopupImageContent(camera, { imageUrl: fresh }));
      wireCameraPopup(popup, camera);
    });
  }
}

export function createWebcamAdapter() {
  return {
    toLatLng(cam) {
      if (!cam.lat || !cam.lon) return null;
      return [cam.lat, cam.lon];
    },

    toIcon(cam) {
      const color = CAMERA_TYPE_COLOR[cam.type] || CAMERA_DEFAULT_COLOR;
      return L.divIcon({
        className: 'camera-marker',
        html: `
          <div style="
            background: ${color};
            border: 2px solid white;
            border-radius: 4px;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            color: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            cursor: pointer;
          ">📷</div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
    },

    toPopup(cam) {
      return cam.media === 'linkout'
        ? cameraPopupLinkoutContent(cam)
        : cameraPopupImageContent(cam);
    },

    toPopupOptions() {
      return { closeButton: true, minWidth: 240, maxWidth: 320 };
    },

    toMarkerOptions(cam) {
      return { title: `${escapeHtml(cam.name)} (${escapeHtml(cam.attribution)})` };
    },

    onMarkerCreated(marker, cam) {
      if (cam.media !== 'linkout') {
        marker.on('popupopen', (event) => wireCameraPopup(event.popup, cam));
      }
    },
  };
}
