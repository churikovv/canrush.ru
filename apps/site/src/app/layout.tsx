import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
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
  metadataBase: new URL('https://canrush.ru'),
  title: {
    default: 'CanRush',
    template: '%s | CanRush',
  },
  description: 'Сервис по поиску цен на энергетические напитки.',
};

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#006eff',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ru" className={objectSans.variable}>
      <body>
        <a className="skip-link" href="#main-content">
          Перейти к содержанию
        </a>
        {children}
      </body>
    </html>
  );
}
