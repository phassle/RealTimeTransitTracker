export const MANIFEST_NAME = 'Sweden Real-Time Transit Map';
export const MANIFEST_SHORT_NAME = 'Transit Map';
export const MANIFEST_DISPLAY = 'standalone';
export const MANIFEST_START_URL = '/';
export const MANIFEST_THEME_COLOR_LIGHT = '#ffffff';
export const MANIFEST_THEME_COLOR_DARK = '#1e1e2e';
export const MANIFEST_BACKGROUND_COLOR = '#ffffff';

export const manifestIcons = [
  { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
  { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
  { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

export const manifestConfig = {
  name: MANIFEST_NAME,
  short_name: MANIFEST_SHORT_NAME,
  display: MANIFEST_DISPLAY,
  start_url: MANIFEST_START_URL,
  theme_color: MANIFEST_THEME_COLOR_LIGHT,
  background_color: MANIFEST_BACKGROUND_COLOR,
  icons: manifestIcons,
};
