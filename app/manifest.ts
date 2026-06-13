import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CrewCall',
    short_name: 'CrewCall',
    description: 'Blue collar hiring network for skilled trades.',
    start_url: '/',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#020617',
    orientation: 'portrait',
    scope: '/',
    lang: 'en-US',
  }
}