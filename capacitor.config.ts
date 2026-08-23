import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.crewcall.app',
  appName: 'CrewCall',
  webDir: 'mobile-shell',

  server: {
    url: 'https://usecrewcall.com',
    cleartext: false,
    allowNavigation: [
      'usecrewcall.com',
      '*.supabase.co',
      '*.stripe.com',
    ],
  },

  ios: {
    contentInset: 'automatic',
    backgroundColor: '#020617',
  },
}

export default config
