import localFont from 'next/font/local';

/** The site's typeface: the root layout and `global-error`, which replaces it, both set it on `html`. */
export const objectSans = localFont({
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
