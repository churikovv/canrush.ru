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
}

type RetailerIconManifest = Record<string, string>;

let manifestCache: RetailerIconManifest | null = null;

async function loadManifest(): Promise<RetailerIconManifest> {
  if (manifestCache) return manifestCache;
  try {
    const manifestPath = path.join(process.cwd(), 'data', 'retailer-icons.json');
    const raw = await readFile(manifestPath, 'utf-8');
    manifestCache = JSON.parse(raw) as RetailerIconManifest;
  } catch {
    manifestCache = {};
  }
  return manifestCache;
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

async function retailerAsset(name: string): Promise<RetailerAsset | null> {
  const handcrafted = handcraftedAsset(name);
  if (handcrafted) return handcrafted;

  const manifest = await loadManifest();
  const iconPath = manifest[name];
  return iconPath ? { src: iconPath, size: 18 } : null;
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
  const asset = await retailerAsset(name);
  const accessibility = decorative ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': `Магазин ${name}` };

  return (
    <span className={`retailer-badge retailer-badge-${size}`} title={name} {...accessibility}>
      {asset ? <Image src={asset.src} width={asset.size} height={asset.size} alt="" /> : <span>{initials(name)}</span>}
    </span>
  );
}
