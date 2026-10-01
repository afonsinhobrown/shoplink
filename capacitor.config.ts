import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shoplink.app',
  appName: 'shoplink',
  webDir: 'out',
  server: {
    url: 'https://shoplink-iota.vercel.app',
    cleartext: true
  }
};

export default config;
