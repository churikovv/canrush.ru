import type { Metadata } from 'next';

export const SITE_NAME = 'CanRush';
export const SITE_URL = 'https://canrush.ru';
export const DEFAULT_DESCRIPTION =
  'CanRush — социальная сеть для любителей энергетиков: отзывы, рейтинги и тирлисты, сравнение цен в магазинах России и маркет редких напитков.';

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };

/** A link-preview picture. Next replaces the `openGraph` object per page, so every page has to name its image again. */
export function ogImage(url: string, alt: string) {
  return { url, ...OG_IMAGE_SIZE, type: 'image/jpeg', alt };
}

export const DEFAULT_OG_IMAGE = ogImage('/og/default', 'CanRush — цены, отзывы и рейтинги энергетиков');

interface SeoMetadataOptions {
  title: string;
  description: string;
  path: string;
  image?: ReturnType<typeof ogImage>;
}

export function seoMetadata({ title, description, path, image = DEFAULT_OG_IMAGE }: SeoMetadataOptions): Metadata {
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
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}
