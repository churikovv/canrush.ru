import { cookies, headers } from 'next/headers';
import { parseSiteTheme, SITE_THEME_COOKIE } from '@/lib/site-theme';
import { CampaignTracker } from '@/components/campaign-tracker';
import { NavigationProgressProvider } from '@/components/navigation-progress';
import type { Metadata, Viewport } from 'next';
import { Suspense, type ReactNode } from 'react';
import { NotificationStateProvider } from '@/components/notification-state';
import { ActivityHeartbeat } from '@/components/profile-presence';
import { CookieNotice } from '@/components/cookie-notice';
import { SiteMotionProvider } from '@/components/site-motion-provider';
import { TelegramMiniApp } from '@/components/telegram-mini-app';
import { NativeAppShell } from '@/components/native-app-shell';
import { YandexMetrika } from '@/components/yandex-metrika';
import { GoogleAnalytics } from '@/components/google-analytics';
import { googleAnalyticsId } from '@/lib/google-analytics';
import { DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from '@/lib/seo';
import { objectSans } from './fonts';
import './globals.css';
import './site-theme.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: 'CanRush — цены и рейтинги энергетиков',
    template: '%s | CanRush',
  },
  description: DEFAULT_DESCRIPTION,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon-48.png', sizes: '48x48', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
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
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
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

const VIEWPORT: Viewport = {
  colorScheme: 'light dark',
  themeColor: '#006eff',
  width: 'device-width',
  initialScale: 1,
};

/**
 * In the apps (User-Agent «CanrushApp/Android» or «CanrushApp/iOS») the page draws under the status and navigation bars
 * (viewport-fit=cover → Capacitor SystemBars passes the insets through): the header backing and the tab bar
 * colour them, and env(safe-area-inset-*) keeps content clear. Browsers keep the default viewport.
 * The layout already reads cookies, so reading headers here does not make anything dynamic that was not.
 */
export async function generateViewport(): Promise<Viewport> {
  const app = (await headers()).get('user-agent')?.includes('CanrushApp/');
  return app ? { ...VIEWPORT, viewportFit: 'cover' } : VIEWPORT;
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const theme = parseSiteTheme((await cookies()).get(SITE_THEME_COOKIE)?.value) ?? 'system';
  const analyticsId = googleAnalyticsId();
  return (
    <html data-site-theme={theme} lang="ru" className={objectSans.variable} data-scroll-behavior="smooth">
      <body>
        <SiteMotionProvider>
          <a className="skip-link" href="#main-content">
            Перейти к содержанию
          </a>
          <NavigationProgressProvider><NotificationStateProvider>{children}</NotificationStateProvider></NavigationProgressProvider>
          <CookieNotice />
          <ActivityHeartbeat />
          <TelegramMiniApp />
          <NativeAppShell />
          {analyticsId && <GoogleAnalytics id={analyticsId} />}
          <Suspense fallback={null}>
            <YandexMetrika />
            <CampaignTracker />
          </Suspense>
        </SiteMotionProvider>
      </body>
    </html>
  );
}
