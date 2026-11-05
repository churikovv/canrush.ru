import Image from 'next/image';
import { AchievementEmblem } from '@/components/achievement-emblem';
import { cutoutSrc } from '@/lib/can-cutout-src';
import type { AchievementRarity } from '@/lib/profile-achievements';
import type { ShortcutCan } from '@/lib/profile-shortcut-cans';

/**
 * What stands out of a profile activity card (`community-shortcut`): the member's own cans or achievement emblems,
 * fanned over the card's top edge. The first item is the main one and stands in the middle, in front.
 */
type Slot = 'left' | 'center' | 'right';
const SLOTS: Record<number, Slot[]> = { 1: ['center'], 2: ['left', 'right'], 3: ['center', 'left', 'right'] };
const slotsFor = (count: number): Slot[] => SLOTS[Math.min(count, 3)] ?? [];

export function ShortcutCans({ cans }: { cans: ShortcutCan[] }) {
  const slots = slotsFor(cans.length);
  return <span className="shortcut-peek" data-count={cans.length} aria-hidden="true">
    {cans.slice(0, 3).map((can, index) => {
      // A cover from our own files loses its shop background; another site's photo stays a small rounded picture.
      const cutout = cutoutSrc(can.cover);
      return <Image key={can.key} className="shortcut-peek-item" data-slot={slots[index]} data-cutout={cutout ? '' : undefined}
        src={cutout ?? can.cover} width={120} height={120} unoptimized alt="" />;
    })}
  </span>;
}

export interface ShortcutEmblem { key: string; rarity: AchievementRarity; tier: number; tiers: number }

export function ShortcutEmblems({ emblems }: { emblems: ShortcutEmblem[] }) {
  const slots = slotsFor(emblems.length);
  return <span className="shortcut-peek" data-count={emblems.length} data-kind="emblems" aria-hidden="true">
    {emblems.slice(0, 3).map((emblem, index) => <span key={emblem.key} className="shortcut-peek-item" data-slot={slots[index]}>
      <AchievementEmblem achievementKey={emblem.key} rarity={emblem.rarity} tier={emblem.tier} tiers={emblem.tiers} earned />
    </span>)}
  </span>;
}
