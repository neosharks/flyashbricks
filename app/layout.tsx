import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Devanagari } from 'next/font/google';
import { Suspense } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { Toaster } from 'sonner';
import { ThemeScript } from '@/components/layout/theme-script';
import { NavigationProgress } from '@/components/layout/navigation-progress';
import { ServiceWorker } from '@/components/layout/service-worker';
import { publicEnv } from '@/lib/public-env';
import './globals.css';

// Self-hosted and subset by next/font: no third-party request, no layout shift.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const devanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  // 800 is for headings when "bolder text" is on.
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-devanagari',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL),
  title: {
    default: publicEnv.NEXT_PUBLIC_APP_NAME,
    template: `%s · ${publicEnv.NEXT_PUBLIC_APP_NAME}`,
  },
  description: 'Factory manager for fly ash bricks.',
  // A private business tool: nothing here belongs in a search index.
  robots: { index: false, follow: false },
  applicationName: publicEnv.NEXT_PUBLIC_APP_NAME,
  appleWebApp: { capable: true, title: 'Bricks', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Pinch-zoom is never disabled: blocking it is a WCAG failure.
  maximumScale: 5,
  // Lets the installed app draw under the notch; the shell pads with safe-area insets.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f9fafb' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1b1e' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations('common');

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${devanagari.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh">
        {/* Runs before any content paints, so a saved theme never flashes. */}
        <ThemeScript />
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <a href="#main" className="skip-link">
          {t('skipToContent')}
        </a>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <Toaster position="top-center" closeButton richColors />
        <ServiceWorker />
      </body>
    </html>
  );
}
