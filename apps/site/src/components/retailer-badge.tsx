import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Image from 'next/image';

interface RetailerBadgeProps {
  name: string;
  size?: 'small' | 'large';
  decorative?: boolean;
}

interface RetailerAsset {
  src: string;
  size: number;
  tile?: boolean;
}

type RetailerIconManifest = Record<string, string | { src?: unknown; tile?: unknown }>;

const MANIFEST_TTL_MS = 60_000;
let manifestCache: { manifest: RetailerIconManifest; loadedAt: number } | null = null;

async function readManifest(): Promise<RetailerIconManifest> {
  try {
    const manifestPath = path.join(process.cwd(), 'data', 'retailer-icons.json');
    return JSON.parse(await readFile(manifestPath, 'utf-8')) as RetailerIconManifest;
  } catch {
    return {};
  }
}

async function loadManifest(): Promise<RetailerIconManifest> {
  if (manifestCache && Date.now() - manifestCache.loadedAt < MANIFEST_TTL_MS) return manifestCache.manifest;
  const manifest = await readManifest();
  manifestCache = { manifest, loadedAt: Date.now() };
  return manifest;
}

function manifestAsset(entry: RetailerIconManifest[string] | undefined, badgeSize: number): RetailerAsset | null {
  if (typeof entry === 'string') return { src: entry, size: 18 };
  if (!entry || typeof entry.src !== 'string' || !entry.src.startsWith('/')) return null;
  return entry.tile === true ? { src: entry.src, size: badgeSize, tile: true } : { src: entry.src, size: 18 };
}

function handcraftedAsset(name: string): RetailerAsset | null {
  const normalized = name.toLocaleLowerCase('ru-RU').replace(/ё/gu, 'е');
  if (normalized.includes('пятероч')) return { src: '/brand/retailers/pyaterochka.svg', size: 18 };
  if (normalized.includes('перекрест')) return { src: '/brand/retailers/perekrestok.svg', size: 18 };
  if (normalized.includes('магнит')) return { src: '/brand/retailers/magnit.svg', size: 18 };
  if (normalized.includes('лента')) return { src: '/brand/retailers/lenta.png', size: 20 };
  if (normalized.includes('дикси')) return { src: '/brand/retailers/dixy.svg', size: 16 };
  return null;
}

async function retailerAsset(name: string, badgeSize: number): Promise<RetailerAsset | null> {
  const handcrafted = handcraftedAsset(name);
  if (handcrafted) return handcrafted;

  const manifest = await loadManifest();
  return manifestAsset(manifest[name], badgeSize);
}

function initials(name: string): string {
  const words = name.match(/[a-zа-яё0-9]+/giu) ?? [];
  if (words.length === 0) return '•';
  if (words.length === 1) return words[0]!.slice(0, 2).toLocaleUpperCase('ru-RU');
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toLocaleUpperCase('ru-RU');
}

export async function RetailerBadge({ name, size = 'small', decorative = false }: RetailerBadgeProps) {
  const asset = await retailerAsset(name, size === 'large' ? 34 : 28);
  const accessibility = decorative ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': `Магазин ${name}` };
  const className = `retailer-badge retailer-badge-${size}${asset?.tile ? ' retailer-badge-tile' : ''}`;

  return (
    <span className={className} title={name} {...accessibility}>
      {asset ? <Image src={asset.src} width={asset.size} height={asset.size} alt="" /> : <span>{initials(name)}</span>}
    </span>
  );
}
