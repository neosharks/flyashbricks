'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker in production builds only: in development it
 * would serve stale build assets across hot reloads.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err: unknown) => {
      console.warn('service worker registration failed', err);
    });
  }, []);

  return null;
}
