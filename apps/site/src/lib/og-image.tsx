import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import type { ReactElement, ReactNode } from 'react';
import sharp from 'sharp';
import { BACKDROP_SAMPLE, whiteBackdropColor } from '@/lib/cover-backdrop';
import { coverBytes } from '@/lib/cover-hash';
import { ogText, ogTitleSize } from '@/lib/og-text';
import { OG_IMAGE_SIZE } from '@/lib/seo';

/**
 * Link previews (Telegram first of all): one blue card with a white tile, the shell of the site. The pictures are drawn
 * on request and answered as JPEG: a can photo in PNG goes over the 300 KB a preview should weigh.
 */
const BRAND = '#006eff';
const HOUR = 60 * 60;
export const OG_DAY = 24 * HOUR;
export const OG_HOUR = HOUR;
const TILE = { width: 452, height: 534 };
const TILE_PADDING = 36;
const MAX_RENDERED = 300;

interface OgFont { name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' }
let fonts: Promise<OgFont[]> | undefined;

/** next/og does not read woff2, so the fonts live beside the site's ones as OTF (traced in next.config.ts for standalone). */
function loadFonts(): Promise<OgFont[]> {
  const read = async (file: string, weight: 400 | 700): Promise<OgFont> => {
    const bytes = await readFile(path.join(process.cwd(), 'fonts', file));
    return { name: 'Object Sans', data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, weight, style: 'normal' };
  };
  fonts ??= Promise.all([read('PPObjectSans-Regular.otf', 400), read('PPObjectSans-Heavy.otf', 700)]);
  return fonts;
}

const svgData = async (file: string) => `data:image/svg+xml;base64,${(await readFile(path.join(process.cwd(), 'public', file))).toString('base64')}`;

async function ogLogo(): Promise<ReactElement> {
  const [mark, wordmark] = await Promise.all([svgData('brand/logo-mark-white.svg'), svgData('brand/logo-wordmark-white.svg')]);
  return <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
    {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
    <img src={mark} width={68} height={52} />
    {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
    <img src={wordmark} width={175} height={50} />
  </div>;
}

interface OgPhoto { src: string; width: number; height: number }

async function ogPhoto(bytes: Buffer, width: number, height: number): Promise<OgPhoto> {
  const { data, info } = await sharp(bytes, { limitInputPixels: 40_000_000 }).flatten({ background: '#ffffff' })
    .resize({ width, height, fit: 'inside' }).jpeg({ quality: 90 }).toBuffer({ resolveWithObject: true });
  return { src: `data:image/jpeg;base64,${data.toString('base64')}`, width: info.width, height: info.height };
}

/** The white tile: a can photo or a piece of brand art, whole and centred. It takes a shop photo's «white», as in the catalog. */
async function ogTile(bytes: Buffer): Promise<ReactElement> {
  const [photo, sample] = await Promise.all([
    ogPhoto(bytes, TILE.width - TILE_PADDING * 2, TILE.height - TILE_PADDING * 2),
    sharp(bytes, { limitInputPixels: 40_000_000 }).ensureAlpha().resize(BACKDROP_SAMPLE, BACKDROP_SAMPLE, { fit: 'fill' }).raw().toBuffer(),
  ]);
  const background = whiteBackdropColor(new Uint8ClampedArray(sample)) ?? '#ffffff';
  return <div style={{ ...TILE, display: 'flex', flexShrink: 0, alignItems: 'center', justifyContent: 'center', background, borderRadius: 32 }}>
    {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
    <img {...photo} />
  </div>;
}

const brandArt = (name: string) => readFile(path.join(process.cwd(), 'public/brand/home', `${name}.png`));

interface OgCardProps { logo: ReactNode; eyebrow?: string; title: string; note?: ReactNode; tile: ReactNode }

function OgCard({ logo, eyebrow, title, note, tile }: OgCardProps) {
  return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 48, padding: 48, background: BRAND, color: '#ffffff', fontFamily: 'Object Sans' }}>
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexGrow: 1, flexBasis: 0, minWidth: 0, height: '100%' }}>
      {logo}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {eyebrow ? <div style={{ display: 'flex', fontSize: 36 }}>{eyebrow}</div> : null}
        <div style={{ display: 'block', fontSize: ogTitleSize(title), fontWeight: 700, lineHeight: 1.08, lineClamp: 3, wordBreak: 'break-word' }}>{title}</div>
        {note}
      </div>
    </div>
    {tile}
  </div>;
}

const STAR = 'M12 2.5l2.9 6.2 6.8.8-5 4.6 1.3 6.7-6-3.3-6 3.3 1.3-6.7-5-4.6 6.8-.8z';

function OgRating({ value, reviews }: { value: string; reviews: string }) {
  return <div style={{ display: 'flex', alignItems: 'center', alignSelf: 'flex-start', gap: 12, marginTop: 8, padding: '12px 26px', background: '#ffffff', borderRadius: 999, color: '#000000', fontSize: 34 }}>
    <svg width="34" height="34" viewBox="0 0 24 24"><path d={STAR} fill={BRAND} /></svg>
    <span style={{ fontWeight: 700 }}>{value}</span>
    <span style={{ color: '#3e3e3f' }}>{reviews}</span>
  </div>;
}

const rendered = new Map<string, { jpeg: Buffer; until: number }>();

/**
 * The answer for a route. Drawing runs on the main thread (a resvg wasm), so a link posted to a big chat must not draw
 * it once per client: a finished picture stays in memory (oldest out first) and the response is cacheable. Only here
 * under /og: proxy.ts marks everything under /catalog and /tierlists as no-store.
 */
export async function ogResponse(key: string, draw: () => Promise<ReactElement>, maxAge = OG_DAY): Promise<Response> {
  let entry = rendered.get(key);
  if (!entry || entry.until < Date.now()) {
    const png = await new ImageResponse(await draw(), { ...OG_IMAGE_SIZE, fonts: await loadFonts() }).arrayBuffer();
    entry = { jpeg: await sharp(Buffer.from(png)).jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer(), until: Date.now() + maxAge * 1000 };
    rendered.delete(key);
    rendered.set(key, entry);
    if (rendered.size > MAX_RENDERED) rendered.delete(rendered.keys().next().value!);
  }
  return new Response(new Uint8Array(entry.jpeg), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=${maxAge}` } });
}

export async function defaultOgCard(): Promise<ReactElement> {
  return <OgCard logo={await ogLogo()} title="Цены, отзывы и рейтинги энергетиков" tile={await ogTile(await brandArt('catalog'))} />;
}

interface DrinkCard { brand: string; flavor: string; cover?: string | null; rating?: { value: string; reviews: string } | null }

/** A can: its photo when we hold it ourselves (a shop's address is never fetched), the catalog art otherwise. */
export async function drinkOgCard({ brand, flavor, cover, rating }: DrinkCard): Promise<ReactElement> {
  const photo = cover ? await coverBytes(cover).catch(() => null) : null;
  const tile = await ogTile(photo ?? await brandArt('catalog')).catch(async () => ogTile(await brandArt('catalog')));
  return <OgCard logo={await ogLogo()} eyebrow={ogText(brand)} title={ogText(flavor) || ogText(brand)} note={rating ? <OgRating {...rating} /> : undefined} tile={tile} />;
}

export async function tierListOgCard({ title, author }: { title: string; author: string }): Promise<ReactElement> {
  return <OgCard logo={await ogLogo()} eyebrow="Тирлист" title={ogText(title) || 'Тирлист энергетиков'} note={<div style={{ display: 'flex', fontSize: 34 }}>{ogText(`от @${author}`)}</div>} tile={await ogTile(await brandArt('tierlists'))} />;
}

/** A season: its poster takes the tile's place, so the near-square frame of the scene makes a 1200×630 picture. */
export async function seasonOgCard({ title, note, poster }: { title: string; note: string; poster: string }): Promise<ReactElement> {
  const bytes = await readFile(path.join(process.cwd(), 'public', poster));
  const photo = await ogPhoto(bytes, TILE.width + 88, TILE.height);
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  const tile = <img {...photo} style={{ flexShrink: 0, borderRadius: 32 }} />;
  return <OgCard logo={await ogLogo()} eyebrow="Банкомат CanRush" title={ogText(title)} note={<div style={{ display: 'flex', fontSize: 34 }}>{ogText(note)}</div>} tile={tile} />;
}
