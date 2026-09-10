import type { Metadata } from 'next';

export const SITE_NAME = 'CanRush';
export const SITE_URL = 'https://canrush.ru';
export const DEFAULT_DESCRIPTION =
  'CanRush помогает сравнивать цены на энергетические напитки в магазинах России, читать отзывы и составлять тирлисты.';

interface SeoMetadataOptions {
  title: string;
  description: string;
  path: string;
}

export function seoMetadata({ title, description, path }: SeoMetadataOptions): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      locale: 'ru_RU',
      siteName: SITE_NAME,
      url: path,
      title,
      description,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}
