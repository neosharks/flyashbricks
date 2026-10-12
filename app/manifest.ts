import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/public-env';

/** Installable as an app on a phone's home screen; opens without browser chrome. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: publicEnv.NEXT_PUBLIC_APP_NAME,
    short_name: 'Bricks',
    description: 'Raw materials, production, stock and sales for a fly ash brick factory.',
    // Signed-out visitors at `/` get the public landing page; the installed app
    // should open on sign-in instead, which forwards signed-in people home.
    start_url: '/login',
    scope: '/',
    id: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f9fafb',
    theme_color: '#0f8f7e',
    lang: 'en',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    shortcuts: [
      { name: 'New sale', short_name: 'Sale', url: '/sales/new' },
      { name: 'Log production', short_name: 'Production', url: '/production?log=1' },
      { name: 'Raw materials', short_name: 'Materials', url: '/raw-materials' },
    ],
  };
}
