'use client';
import Link from '@/components/navigation-progress';
import { useEffect, useId, useRef, useState, useTransition, type CSSProperties } from 'react';
import { AvatarFrame } from '@/components/avatar-frame';
import { BottomSheet, BottomSheetHead } from '@/components/bottom-sheet';
import { ProfileTag } from '@/components/profile-tag';
import type { ShopActionResult } from '@/app/profile/shop-actions';
import { pluralRu } from '@/lib/drink-calendar-fields';
import type { ProfileAppearance } from '@/lib/profile-appearance';
import { SHOP_ITEMS, SHOP_TIERS, weeklyDeal, type ShopItem, type ShopKind } from '@/lib/shop-items';

export interface ShopView { earned: number; sources: { achievements: number; levels: number; race: number; daily: number }; balance: number; owned: string[] }
/** The purchase, given from above (`buyShopItemAction`): the strip renders in tests without the auth environment. */
export type ShopBuy = (key: string) => Promise<ShopActionResult>;

export const sparks = (value: number) => `${value.toLocaleString('ru-RU')} ${pluralRu(value, 'искра', 'искры', 'искр')}`;

/** The shop's currency, «Искры»: a four-pointed spark. */
export function SparkIcon({ size = 16 }: { size?: number }) {
  return <svg className="spark-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 1.5c.9 5.4 2.6 8.2 9.5 10.5-6.9 2.3-8.6 5.1-9.5 10.5-.9-5.4-2.6-8.2-9.5-10.5 6.9-2.3 8.6-5.1 9.5-10.5Z" fill="currentColor" />
    <circle cx="12" cy="12" r="2.2" fill="#fff8d6" />
  </svg>;
}

/** A tag is shown as it will stand: next to the member's name. A frame — on the member's avatar. */
function Preview({ item, avatarSrc, name, large }: { item: ShopItem; avatarSrc: string | null; name: string; large?: boolean }) {
  if (item.kind === 'tag') return <span className="shop-preview shop-preview-tag" data-large={large || undefined}>
    <span className="shop-preview-name">{name}</span><ProfileTag tag={item.key}>{item.label}</ProfileTag>
  </span>;
  return <span className="shop-preview shop-preview-frame" data-large={large || undefined}>
    <span className="appearance-frame-sample community-avatar" data-frame={item.key} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- the member's own avatar, also a fresh upload preview */}
      {avatarSrc ? <img src={avatarSrc} alt="" loading="lazy" /> : name.slice(0, 1).toUpperCase()}<AvatarFrame frame={item.key as ProfileAppearance['frame']} />
    </span>
  </span>;
}

const daysLeft = (endsAt: Date, now: Date) => {
  const days = Math.max(1, Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000));
  return `ещё ${days} ${pluralRu(days, 'день', 'дня', 'дней')}`;
};

/**
 * The look shop: tags and frames for «Искры» (`shop-items.ts`). A purchase takes two taps — the price, then
 * «Подтвердить» — and is final; the item is put on the preview by «Надеть» and saved with the profile, like any choice.
 * One item a week is a quarter cheaper. Backgrounds are announced, not sold yet.
 */
export function ProfileShop({ open, onClose, shop, buy: purchase, onBought, worn, onWear, avatarSrc, name, href, initialKind = 'tag' }: {
  open: boolean; onClose: () => void; shop: ShopView; buy: ShopBuy; onBought: (shop: ShopView, key: string) => void;
  worn: { tag: string; frame: string }; onWear: (item: ShopItem) => void; avatarSrc: string | null; name: string; href: string; initialKind?: ShopKind;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [kind, setKind] = useState<ShopKind | 'theme'>(initialKind);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [pending, start] = useTransition();
  // The deal changes on Monday; the time is read when the sheet opens, so server and browser render the same.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) { node.showModal(); setKind(initialKind); setMessage(null); setConfirm(null); setNow(new Date()); }
    if (!open && node.open) node.close();
  }, [open, initialKind]);
  // The confirmation waits a few seconds, then the button goes back to the price.
  useEffect(() => {
    if (!confirm) return;
    const timer = window.setTimeout(() => setConfirm(null), 4000);
    return () => window.clearTimeout(timer);
  }, [confirm]);

  const deal = now ? weeklyDeal(now) : null;
  const priceOf = (item: ShopItem) => deal?.item.key === item.key ? deal.price : item.price;
  const buy = (item: ShopItem) => {
    if (confirm !== item.key) { setConfirm(item.key); setMessage(null); return; }
    setConfirm(null);
    start(async () => {
      const result = await purchase(item.key);
      if (!result.ok) { setMessage({ tone: 'error', text: result.error }); return; }
      onBought(result.shop, item.key);
      setMessage({ tone: 'ok', text: `${item.kind === 'tag' ? 'Тег' : 'Рамка'} «${item.label}» теперь ${item.kind === 'tag' ? 'ваш' : 'ваша'}: нажмите «Надеть», а потом «Сохранить».` });
    });
  };

  const action = (item: ShopItem) => {
    const wearing = item.kind === 'tag' ? worn.tag === item.key : worn.frame === item.key;
    const price = priceOf(item);
    if (shop.owned.includes(item.key)) return <button type="button" className="shop-buy is-owned" disabled={wearing} onClick={() => { onWear(item); dialog.current?.close(); }}>{wearing ? 'Надето' : 'Надеть'}</button>;
    if (price > shop.balance) return <span className="shop-short">
      <span className="shop-short-meter" role="progressbar" aria-valuemin={0} aria-valuemax={price} aria-valuenow={shop.balance} aria-label={`Накоплено на «${item.label}»`}><i style={{ '--value': shop.balance / price } as CSSProperties} /></span>
      <span className="shop-short-copy"><SparkIcon size={13} />{price}<small>ещё {price - shop.balance}</small></span>
    </span>;
    const confirming = confirm === item.key;
    return <button type="button" className="shop-buy" data-confirm={confirming || undefined} disabled={pending} onClick={() => buy(item)}
      aria-label={confirming ? `Подтвердить покупку «${item.label}» за ${sparks(price)}` : `Купить «${item.label}» за ${sparks(price)}`}>
      {confirming ? 'Подтвердить' : <><SparkIcon size={14} />{price}</>}
    </button>;
  };

  const items = SHOP_ITEMS.filter(item => item.kind === kind).sort((a, b) => a.price - b.price);
  const count = (of: ShopKind) => `${SHOP_ITEMS.filter(item => item.kind === of && shop.owned.includes(item.key)).length}/${SHOP_ITEMS.filter(item => item.kind === of).length}`;
  return <BottomSheet ref={dialog} className="shop-sheet" labelledBy={titleId} onClose={onClose}>
    <BottomSheetHead id={titleId} title="Магазин образов" onClose={() => dialog.current?.close()} />
    <section className="shop-wallet" aria-label="Ваши искры">
      <span className="shop-wallet-coin"><SparkIcon size={30} /></span>
      <p className="shop-wallet-main"><strong>{shop.balance.toLocaleString('ru-RU')}</strong> {pluralRu(shop.balance, 'искра', 'искры', 'искр')}</p>
      <ul className="shop-wallet-sources">
        <li><span>Достижения</span><b>{shop.sources.achievements}</b></li>
        <li><span>Уровни</span><b>{shop.sources.levels}</b></li>
        <li><span>Гонка недели</span><b>{shop.sources.race}</b></li>
        <li><span>Лунный цикл</span><b>{shop.sources.daily}</b></li>
      </ul>
      {shop.earned !== shop.balance && <p className="shop-wallet-spent">Заработано {shop.earned.toLocaleString('ru-RU')} · потрачено {(shop.earned - shop.balance).toLocaleString('ru-RU')}</p>}
      <p className="shop-wallet-note">Искры приходят сами: за достижения, каждый новый уровень и места в гонке недели. Купить их нельзя. <Link href={href}>Ближайшие достижения</Link></p>
    </section>
    {deal && !shop.owned.includes(deal.item.key) && <section className="shop-deal" data-tier={deal.item.tier} aria-label="Предложение недели">
      <span className="shop-deal-badge">Предложение недели · −25%</span>
      <div className="shop-deal-body">
        <Preview item={deal.item} avatarSrc={avatarSrc} name={name} large />
        <div className="shop-deal-copy">
          <strong>{deal.item.label}</strong>
          <span>{SHOP_TIERS[deal.item.tier].label} {deal.item.kind === 'tag' ? 'тег' : 'рамка'} · {daysLeft(deal.endsAt, now!)}</span>
          <span className="shop-deal-price"><s>{deal.item.price}</s><SparkIcon size={14} />{deal.price}</span>
        </div>
      </div>
      {action(deal.item)}
    </section>}
    <div className="shop-tabs" role="tablist" aria-label="Что купить">
      {([['tag', 'Теги'], ['frame', 'Рамки'], ['theme', 'Фоны']] as const).map(([key, label]) =>
        <button key={key} type="button" role="tab" aria-selected={kind === key} className="shop-tab" onClick={() => { setKind(key); setConfirm(null); }}>
          {label}{key === 'theme' ? <span className="shop-soon">скоро</span> : <small>{count(key)}</small>}
        </button>)}
    </div>
    {message && <p className={`shop-message is-${message.tone}`} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    {kind === 'theme'
      ? <div className="shop-empty"><p><strong>Фоны профиля появятся здесь позже.</strong></p><p>Копите искры: всё, что не потратите сейчас, останется.</p></div>
      : <ul className="shop-grid">{items.map(item => <li key={item.key} className="shop-item" data-tier={item.tier} data-owned={shop.owned.includes(item.key) || undefined}>
        <span className="shop-tier">{SHOP_TIERS[item.tier].label}{deal?.item.key === item.key && <em>−25%</em>}</span>
        <Preview item={item} avatarSrc={avatarSrc} name={name} />
        <span className="shop-item-copy"><strong>{item.label}</strong><span>{item.description}</span></span>
        {action(item)}
      </li>)}</ul>}
  </BottomSheet>;
}
