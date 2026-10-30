import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultOgCard, drinkOgCard, ogResponse, seasonOgCard, tierListOgCard } from '@/lib/og-image';
import { ogText, ogTitleSize } from '@/lib/og-text';
import { DEFAULT_OG_IMAGE, ogImage, seoMetadata } from '@/lib/seo';

const metaImages = (metadata: ReturnType<typeof seoMetadata>) => metadata.openGraph?.images;

async function picture(response: Response) {
  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, meta: await sharp(bytes).metadata() };
}

describe('link preview metadata', () => {
  it('gives every page the site picture unless it names its own', () => {
    expect(metaImages(seoMetadata({ title: 't', description: 'd', path: '/x' }))).toEqual([DEFAULT_OG_IMAGE]);
    const own = ogImage('/og/drink/x', 'Burn, Манго');
    expect(metaImages(seoMetadata({ title: 't', description: 'd', path: '/x', image: own }))).toEqual([own]);
    expect(own).toMatchObject({ width: 1200, height: 630, type: 'image/jpeg' });
  });
});

describe('ogText', () => {
  it('keeps what the font can draw and drops the rest', () => {
    expect(ogText('  Любимые  😀 энергетики №1 — «топ»\n2026 ')).toBe('Любимые энергетики №1 — «топ» 2026');
    expect(ogText('Monster Ultra Paradise')).toBe('Monster Ultra Paradise');
    expect(ogText('😀🔥')).toBe('');
  });

  it('shrinks a long headline', () => {
    expect(ogTitleSize('Манго')).toBeGreaterThan(ogTitleSize('Очень длинное название тирлиста участника сообщества CanRush'));
  });
});

describe('link preview pictures', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('asks the network for a glyph the font lacks: why ogText filters the text', async () => {
    const fetch = vi.fn(async () => new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetch);
    await ogResponse('test:control', async () => <div style={{ display: 'flex' }}>😀</div>).catch(() => null);
    expect(fetch).toHaveBeenCalled();
  });

  it('draws a 1200×630 JPEG under 300 KB without touching the network', async () => {
    const fetch = vi.fn(async () => new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetch);
    const cards = [
      ['default', () => defaultOgCard()],
      // A shop address must not be fetched: the catalog art stands in.
      ['drink', () => drinkOgCard({ brand: 'Burn', flavor: 'Манго · без сахара', cover: 'https://leonardo.edadeal.io/can.jpg', rating: { value: '8.4/10', reviews: '12 отзывов' } })],
      ['drink-local', () => drinkOgCard({ brand: 'Adrenaline Rush', flavor: 'Оригинальный', cover: '/brand/products/adrenaline-rush-original.jpg' })],
      ['tier', () => tierListOgCard({ title: '🔥 Лучшие энергетики всех времён и народов, которые я пробовал этой осенью, и ещё много слов сверх трёх строк', author: 'участник😀' })],
      ['season', () => seasonOgCard({ title: 'Тыквенный автомат', note: 'Сезон до 2 ноября', poster: 'brand/gacha/halloween-poster.jpg' })],
    ] as const;
    for (const [name, draw] of cards) {
      const response = await ogResponse(`test:${name}`, draw);
      expect(response.headers.get('content-type')).toBe('image/jpeg');
      expect(response.headers.get('cache-control')).toContain('public');
      const { bytes, meta } = await picture(response);
      expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 1200, 630]);
      expect(bytes.length).toBeLessThan(300_000);
    }
    expect(fetch).not.toHaveBeenCalled();
  }, 30_000);

  it('draws a picture once while it is fresh', async () => {
    const draw = vi.fn(defaultOgCard);
    await ogResponse('test:once', draw);
    await ogResponse('test:once', draw);
    expect(draw).toHaveBeenCalledTimes(1);
  });
});
