import type { Metadata } from 'next';
import { WifiOff } from 'lucide-react';
import { DeliveryTruck } from '@/components/illustrations';

export const metadata: Metadata = { title: 'Offline', robots: { index: false } };

/**
 * Precached by the service worker and shown when a page cannot be reached.
 * Static and bilingual in one page: the cached copy cannot know which language
 * the person chose.
 */
export default function OfflinePage() {
  return (
    <main
      id="main"
      className="brick-pattern flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center"
    >
      {/* A loaded truck waiting by the road, with the connection badge on it. */}
      <div className="relative w-48">
        <DeliveryTruck />
        <span className="bg-surface text-action absolute -top-3 -right-3 rounded-full p-2 shadow-sm">
          <WifiOff aria-hidden className="size-5" />
        </span>
      </div>
      <div className="bg-surface/90 max-w-sm rounded-lg p-5 shadow-sm">
        <h1 className="text-xl font-semibold">You are offline</h1>
        <p className="text-foreground-muted mt-1 text-sm">
          Check the internet connection and try again. Nothing you have saved is lost.
        </p>
        <hr className="my-4" />
        <p lang="hi" className="text-lg font-semibold">
          आप ऑफ़लाइन हैं
        </p>
        <p lang="hi" className="text-foreground-muted mt-1 text-sm">
          इंटरनेट कनेक्शन जाँचें और फिर कोशिश करें। जो सहेजा गया है, वह सुरक्षित है।
        </p>
        {/* A full page load on purpose: client-side navigation would try the
            router cache, which is exactly what is unavailable offline. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="bg-action text-action-foreground hover:bg-action-hover mt-5 inline-flex min-h-11 items-center justify-center rounded-md px-5 text-sm font-medium"
        >
          Try again / फिर कोशिश करें
        </a>
      </div>
    </main>
  );
}
