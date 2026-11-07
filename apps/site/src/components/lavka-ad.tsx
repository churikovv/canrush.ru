'use client';

import { useState } from 'react';
import { ActionToast } from '@/components/action-toast';
import { AD_HIDE_DAYS, adHiddenCookie, type PartnerAd, type PromoCode } from '@/lib/partner-ads';

const COPY = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>;
const DONE = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>;
/**
 * Lavka's mark from the owner's file (`Frame.svg`, 44×44), in the on-blue variant of their billboards: a white circle with
 * the heart in the panel's blue (`currentColor`). It sits inside the «Яндекс ♥ Лавка» lockup at the height of the letters.
 * Inline, so it needs no request and stays sharp; the file's full-frame mask and clip did nothing and are left out.
 */
const LAVKA_MARK = <svg className="lavka-ad-mark" viewBox="0 0 44 44" aria-hidden="true">
  <circle cx="22" cy="22" r="22" fill="#fff" />
  <path fill="currentColor" d="M22.881 22.3772C24.631 14.1862 26.2239 11.2002 29.3829 11.2002C34.6229 11.2002 36.9769 16.0242 33.6479 25.9152C30.4419 35.4492 23.368 37.1442 18.228 34.0972C14.5 31.8872 11.5609 27.1122 10.4479 24.4782C8.69795 20.3382 7.77795 15.8132 10.083 13.3432C11.97 11.3202 14.1389 10.3452 18.2269 14.9932C22.3169 19.6402 22.881 22.3762 22.881 22.3762V22.3772Z" />
</svg>;
const CLOSE = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>;

/** The clipboard API, then the old `execCommand` for WebViews and pages without it. */
async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* below */ }
  try {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.append(field);
    field.select();
    const done = document.execCommand('copy');
    field.remove();
    return done;
  } catch { return false; }
}

/**
 * Yandex Lavka's promo codes at the start of a drink card, in the style of Lavka's own outdoor ads: their bright blue with
 * thin light streaks, the «Яндекс ♥ Лавка» lockup alone in the top corner with room around it, the «Реклама» chip and «✕»
 * in the other corner, and a large white headline that leads. The codes come after it as compact chips: the first is the
 * offer (white, −50% on the first order), the rest translucent (−40% for those back after a year). The legal line is small
 * and quiet. It lays out by its slot's width (a container): the card is a column on a computer and the whole screen on a
 * phone. A coupon is the partner's link: a tap copies its code and opens Lavka in a new tab, where it goes into the order.
 * «✕» sets a cookie, so the server stops rendering it in this browser for a week.
 */
export function LavkaAd({ ad, lastDay, marking }: { ad: PartnerAd; lastDay: string; marking: string }) {
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState<{ code: string } | null>(null);
  if (hidden) return null;
  const hide = () => {
    document.cookie = `${adHiddenCookie(ad)}=1; path=/; max-age=${AD_HIDE_DAYS * 24 * 60 * 60}; samesite=lax`;
    setHidden(true);
  };
  const coupon = (item: PromoCode, main: boolean) => <a key={item.code} className={`lavka-ad-coupon ${main ? 'is-main' : 'is-minor'}`} href={ad.href} target="_blank" rel="sponsored noopener"
    data-copied={copied?.code === item.code ? '' : undefined} aria-label={`${item.value} ${item.who}: скопировать промокод ${item.code} и открыть Лавку`}
    onClick={() => { void copyText(item.code).then(done => { if (done) setCopied({ code: item.code }); }); }}>
    <span className="lavka-ad-off"><b>{item.value}</b><small>{item.who}</small></span>
    <span className="lavka-ad-code"><code>{item.code}</code>{copied?.code === item.code ? DONE : COPY}</span>
  </a>;
  const [main, ...minor] = ad.codes;
  return <div className="lavka-ad-slot"><aside className="lavka-ad" aria-label="Реклама: промокоды Яндекс Лавки">
    <p className="lavka-ad-logo" aria-label="Яндекс Лавка"><span>Яндекс</span>{LAVKA_MARK}<span>Лавка</span></p>
    <div className="lavka-ad-top">
      <span className="lavka-ad-label">Реклама</span>
      <button type="button" className="lavka-ad-close" onClick={hide} aria-label="Скрыть рекламу на неделю">{CLOSE}</button>
    </div>
    <p className="lavka-ad-title">Холодный энергетик <br />с быстрой доставкой</p>
    <div className="lavka-ad-offers">
      {main && coupon(main, true)}
      {minor.map(item => coupon(item, false))}
    </div>
    <p className="lavka-ad-fine">{ad.terms}, до {lastDay}. {marking}</p>
    <ActionToast trigger={copied ?? ad} message={copied ? `Промокод ${copied.code} скопирован — вставьте его в Лавке` : undefined} />
  </aside></div>;
}
