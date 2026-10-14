import type { CSSProperties, ReactNode } from 'react';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import type { NavigationSection } from '@/components/navigation-icon';

type Size = number | string;
/** 'auto' leaves the size to the block's class (aspect-ratio or fixed height there). */
const size = (value: Size | undefined) => typeof value === 'number' ? `${value}px` : value === 'auto' ? undefined : value;

/** One shimmering placeholder block. Pure CSS: renders in the streamed fallback before hydration. */
export function Skeleton({ width, height = 16, radius, className, style }: { width?: Size; height?: Size; radius?: Size; className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={className ? `skeleton ${className}` : 'skeleton'} style={{ width: size(width), height: size(height), borderRadius: size(radius), ...style }} />;
}

export function SkeletonText({ lines = 3, lastWidth = '60%', height = 14 }: { lines?: number; lastWidth?: Size; height?: number }) {
  return <span className="skeleton-text" aria-hidden="true">
    {Array.from({ length: lines }, (_, index) => <Skeleton key={index} height={height} width={index === lines - 1 && lines > 1 ? lastWidth : '100%'} />)}
  </span>;
}

/** Route-level loading page: real header and tab bar, skeleton body, one status for assistive tech. */
export function SkeletonPage({ active, surfaceClassName, navigation = true, wide = false, children }: { active?: NavigationSection; surfaceClassName?: string; navigation?: boolean; wide?: boolean; children: ReactNode }) {
  return <BrandShell headerAction={navigation ? <ProfileNavigation active={active} /> : undefined} surfaceClassName={surfaceClassName}>
    <div className={wide ? 'skeleton-page skeleton-page-wide' : 'skeleton-page'} aria-busy="true">
      <p className="sr-only" role="status">Загружаем страницу…</p>
      {children}
    </div>
  </BrandShell>;
}

export function SkeletonHeading({ subtitle = true, action = false }: { subtitle?: boolean; action?: boolean }) {
  return <div className="skeleton-heading">
    <span className="skeleton-heading-copy"><Skeleton width="min(60%, 340px)" height={36} radius={10} />{subtitle && <Skeleton width="min(85%, 520px)" height={16} />}</span>
    {action && <Skeleton width={120} height={44} radius={12} />}
  </div>;
}

export function SkeletonTabs({ count = 3 }: { count?: number }) {
  return <div className="skeleton-tabs">{Array.from({ length: count }, (_, index) => <Skeleton key={index} width={index ? 104 : 136} height={44} radius={10} />)}</div>;
}

export function SkeletonProductCard() {
  return <div className="skeleton-card skeleton-product-card">
    <Skeleton className="skeleton-media" height="auto" radius={14} />
    <Skeleton width="45%" height={12} />
    <Skeleton width="85%" height={16} />
    <Skeleton width="35%" height={20} />
  </div>;
}

export function SkeletonProductGrid({ count = 8 }: { count?: number }) {
  return <div className="skeleton-grid">{Array.from({ length: count }, (_, index) => <SkeletonProductCard key={index} />)}</div>;
}

export function SkeletonShelf({ count = 6 }: { count?: number }) {
  return <div className="skeleton-shelf">{Array.from({ length: count }, (_, index) => <SkeletonProductCard key={index} />)}</div>;
}

export function SkeletonRows({ count = 5, avatar = true, trailing = true }: { count?: number; avatar?: boolean; trailing?: boolean }) {
  return <div className="skeleton-rows">
    {Array.from({ length: count }, (_, index) => <div className="skeleton-row" key={index}>
      {avatar && <Skeleton width={40} height={40} radius="50%" />}
      <span className="skeleton-row-copy"><Skeleton width={`${70 - (index % 3) * 12}%`} height={15} /><Skeleton width="34%" height={12} /></span>
      {trailing && <Skeleton width={64} height={18} />}
    </div>)}
  </div>;
}

export function SkeletonSectionTitle() {
  return <div className="skeleton-section-title"><Skeleton width={200} height={26} radius={8} /><Skeleton width={44} height={18} /></div>;
}

export function SkeletonTierBoard({ rows = 6 }: { rows?: number }) {
  return <div className="skeleton-tier-board">
    {Array.from({ length: rows }, (_, index) => <div className="skeleton-tier-row" key={index}>
      <Skeleton className="skeleton-tier-label" height="auto" radius={0} />
      <span className="skeleton-tier-items">{Array.from({ length: Math.max(1, 5 - index) }, (_, item) => <Skeleton key={item} width={52} height={72} radius={8} />)}</span>
    </div>)}
  </div>;
}

export function SkeletonDetail() {
  return <div className="skeleton-detail">
    <Skeleton className="skeleton-detail-media" height="auto" radius={24} />
    <div className="skeleton-detail-copy">
      <Skeleton width="40%" height={14} />
      <Skeleton width="80%" height={40} radius={10} />
      <SkeletonText lines={3} />
      <div className="skeleton-detail-stats">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} height={72} radius={14} />)}</div>
      <SkeletonRows count={3} avatar={false} />
    </div>
  </div>;
}

export function SkeletonProfile() {
  return <div className="skeleton-profile">
    <Skeleton className="skeleton-profile-cover" height="auto" radius={20} />
    <div className="skeleton-profile-identity">
      <Skeleton className="skeleton-profile-avatar" width={96} height={96} radius="50%" />
      <span className="skeleton-row-copy"><Skeleton width={200} height={28} radius={8} /><Skeleton width={120} height={14} /><Skeleton width={160} height={26} radius={6} /></span>
    </div>
    <div className="skeleton-shortcuts">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} height={104} radius={16} />)}</div>
    <SkeletonRows count={3} />
  </div>;
}

export function SkeletonChat() {
  return <div className="skeleton-chat">
    <div className="skeleton-row"><Skeleton width={48} height={48} radius={10} /><span className="skeleton-row-copy"><Skeleton width="50%" height={16} /><Skeleton width="30%" height={12} /></span></div>
    <div className="skeleton-chat-messages">
      {['62%', '44%', '70%', '38%', '56%'].map((width, index) => <Skeleton key={index} className={index % 2 ? 'skeleton-bubble-own' : undefined} width={width} height={index === 2 ? 64 : 44} radius={16} />)}
    </div>
    <Skeleton height={52} radius={14} />
  </div>;
}

/** Catalog product: full-width light photo band, then the rounded info panel with tabs and price rows. */
export function SkeletonProduct() {
  return <>
    <div className="skeleton-product-visual"><Skeleton width={150} height={240} radius={20} /></div>
    <div className="skeleton-product-info">
      <div className="skeleton-heading"><span className="skeleton-heading-copy"><Skeleton width={120} height={26} radius={8} /><Skeleton width="min(70%, 360px)" height={32} radius={10} /></span><Skeleton width={128} height={44} radius={12} /></div>
      <SkeletonTabs count={2} />
      <SkeletonTabs count={3} />
      <SkeletonRows count={4} />
    </div>
  </>;
}
