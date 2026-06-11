import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { precacheGlobPatterns, precacheGlobIgnores } from './src/config/swCacheConfig.js';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      devOptions: { enabled: false },
      workbox: {
        globPatterns: precacheGlobPatterns,
        globIgnores: precacheGlobIgnores,
        navigateFallback: 'index.html',
      },
      manifest: false,
    }),
  ],
  server: {
    port: 3000,
  },
  build: {
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    exclude: ['**/node_modules/**', 'src/App.test.jsx'],
  },
});
