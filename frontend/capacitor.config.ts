import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'space.primegaming.app',
  appName: 'Prime Gaming',
  webDir: 'public',
  server: {
    url: 'https://www.primegaming.space',
    cleartext: false,
    errorPath: 'offline.html',
    allowNavigation: [
      'primegaming.space',
      '*.primegaming.space',
      'space.primegaming.app',
      '*.space.primegaming.app',
    ],
  },
};

export default config;
