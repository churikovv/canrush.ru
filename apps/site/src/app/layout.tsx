import { CampaignTracker } from '@/components/campaign-tracker';
import { NavigationProgressProvider } from '@/components/navigation-progress';
import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Suspense, type ReactNode } from 'react';
import { NotificationStateProvider } from '@/components/notification-state';
import { ActivityHeartbeat } from '@/components/profile-presence';
import { CookieNotice } from '@/components/cookie-notice';
import { SiteMotionProvider } from '@/components/site-motion-provider';
import { YandexMetrika } from '@/components/yandex-metrika';
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/seo';
import './globals.css';

const objectSans = localFont({
  src: [
    { path: '../../fonts/PPObjectSans-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../fonts/PPObjectSans-Slanted.woff2', weight: '400', style: 'italic' },
    { path: '../../fonts/PPObjectSans-Heavy.woff2', weight: '700', style: 'normal' },
    { path: '../../fonts/PPObjectSans-HeavySlanted.woff2', weight: '700', style: 'italic' },
  ],
  variable: '--font-object-sans',
  display: 'swap',
  preload: false,
  fallback: ['Arial', 'sans-serif'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: 'CanRush — цены и рейтинги энергетиков',
    template: '%s | CanRush',
  },
  description: DEFAULT_DESCRIPTION,
  manifest: '/manifest.webmanifest',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: SITE_NAME,
    url: SITE_URL,
    title: 'CanRush — цены и рейтинги энергетиков',
    description: DEFAULT_DESCRIPTION,
  },
  twitter: {
    card: 'summary',
    title: 'CanRush — цены и рейтинги энергетиков',
    description: DEFAULT_DESCRIPTION,
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    yandex: process.env.YANDEX_SITE_VERIFICATION,
  },
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#006eff',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ru" className={objectSans.variable} data-scroll-behavior="smooth">
      <body>
        <SiteMotionProvider>
          <a className="skip-link" href="#main-content">
            Перейти к содержанию
          </a>
          <NavigationProgressProvider><NotificationStateProvider>{children}</NotificationStateProvider></NavigationProgressProvider>
          <CookieNotice />
          <ActivityHeartbeat />
          <Suspense fallback={null}>
            <YandexMetrika />
            <CampaignTracker />
          </Suspense>
        </SiteMotionProvider>
      </body>
    </html>
  );
}
