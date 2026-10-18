import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { RetailerBadgeView, type RetailerAsset } from '@/components/retailer-badge-view';

interface RetailerBadgeProps {
  name: string;
  size?: 'small' | 'large';
  decorative?: boolean;
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

/** Assets for client widgets, which cannot render the async server badge themselves. */
export async function retailerAssets(names: string[], size: 'small' | 'large' = 'small'): Promise<Record<string, RetailerAsset | null>> {
  const entries = await Promise.all(names.map(async name => [name, await retailerAsset(name, size === 'large' ? 34 : 28)] as const));
  return Object.fromEntries(entries);
}

export async function RetailerBadge({ name, size = 'small', decorative = false }: RetailerBadgeProps) {
  return <RetailerBadgeView name={name} asset={await retailerAsset(name, size === 'large' ? 34 : 28)} size={size} decorative={decorative} />;
}
