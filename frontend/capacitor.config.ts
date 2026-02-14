import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'space.primegaming.app',
  appName: 'Prime Gaming',
  webDir: 'public',
  server: {
    url: 'https://space.primegaming.app',
    cleartext: false,
    errorPath: 'offline.html',
    allowNavigation: ['space.primegaming.app', '*.space.primegaming.app'],
  },
};

export default config;
