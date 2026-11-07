'use client';

import { useState } from 'react';
import { ActionToast } from '@/components/action-toast';
import { copyText } from '@/lib/copy-text';
import { AD_HIDE_DAYS, adHiddenCookie, type PartnerAd } from '@/lib/partner-ads';

const COPY = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>;
const DONE = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>;
const CLOSE = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>;

/**
 * Perekrestok's logo from the owner's file (`perek.svg`, 191×25): the four-leaf mark and the wordmark in their own
 * greens. Inline, so it needs no request and stays sharp; it sits on white, where every leaf of the mark shows. The
 * file's full-frame clip did nothing and is left out, so no ids repeat on a page.
 */
const PEREKRESTOK_LOGO = <svg viewBox="0 0 191 25" aria-hidden="true">
  <path fill="#5FAF2D" d="M13.3301 6.79204L10.5601 9.58604L7.7891 6.79204C6.2591 5.25004 6.2591 2.74604 7.7891 1.15604C8.15164 0.789922 8.58315 0.499294 9.05869 0.300952C9.53423 0.102611 10.0444 0.000488281 10.5596 0.000488281C11.0748 0.000488281 11.585 0.102611 12.0605 0.300952C12.5361 0.499294 12.9676 0.789922 13.3301 1.15604C14.8601 2.74604 14.8601 5.25004 13.3301 6.79204Z" />
  <path fill="#005A28" d="M7.7891 14.6909L10.5591 11.8979L13.3301 14.6909C14.8601 16.2329 14.8601 18.7379 13.3301 20.3269C12.9676 20.6931 12.5361 20.9837 12.0605 21.182C11.585 21.3804 11.0748 21.4825 10.5596 21.4825C10.0444 21.4825 9.53423 21.3804 9.05869 21.182C8.58315 20.9837 8.15164 20.6931 7.7891 20.3269C6.2591 18.7369 6.2591 16.2329 7.7891 14.6909Z" />
  <path fill="#1EAF37" d="M14.4761 13.584L11.7051 10.742L14.4751 7.94804C14.8376 7.58178 15.2692 7.29102 15.7448 7.09259C16.2205 6.89416 16.7307 6.79199 17.2461 6.79199C17.7614 6.79199 18.2717 6.89416 18.7473 7.09259C19.2229 7.29102 19.6545 7.58178 20.0171 7.94804C21.5461 9.49004 21.5461 11.994 20.0171 13.584C19.6545 13.9502 19.223 14.2408 18.7475 14.4391C18.272 14.6375 17.7618 14.7396 17.2466 14.7396C16.7313 14.7396 16.2212 14.6375 15.7457 14.4391C15.2701 14.2408 14.8386 13.9502 14.4761 13.584Z" />
  <path fill="#AAE641" d="M6.68801 7.94795L9.45901 10.742L6.68901 13.536C6.32645 13.9022 5.89488 14.193 5.41925 14.3914C4.94362 14.5898 4.43337 14.692 3.91801 14.692C3.40265 14.692 2.8924 14.5898 2.41677 14.3914C1.94114 14.193 1.50957 13.9022 1.14701 13.536C-0.382988 11.994 -0.382988 9.48995 1.14701 7.89995C2.62701 6.40695 5.16001 6.40695 6.68801 7.94795Z" />
  <path fill="#005A28" d="M161.905 9.87504H157.844V19.75H154.5V9.87504H150.439V6.59904H161.905V9.87504ZM47.821 14.595H57.567C57.6646 14.1358 57.7129 13.6675 57.711 13.198C57.711 9.34504 54.987 6.26204 51.166 6.26204C47.105 6.26204 44.334 9.29704 44.334 13.198C44.334 17.1 47.057 20.135 51.404 20.135C53.889 20.135 55.847 19.123 57.042 17.341L54.366 15.751C53.793 16.522 52.742 17.052 51.452 17.052C49.732 17.052 48.298 16.329 47.821 14.595ZM47.774 11.946C48.156 10.26 49.398 9.29603 51.166 9.29603C52.551 9.29603 53.984 10.067 54.366 11.946H47.774ZM67.552 6.26204C65.689 6.26204 64.303 6.98504 63.348 8.18904V6.64704H60.004V25H63.348V18.208C64.303 19.412 65.641 20.135 67.552 20.135C71.039 20.135 73.858 17.1 73.858 13.198C73.906 9.29704 71.039 6.26204 67.552 6.26204ZM66.931 16.859C64.876 16.859 63.348 15.366 63.348 13.15C63.348 10.934 64.876 9.44104 66.931 9.44104C68.985 9.44104 70.514 10.934 70.514 13.151C70.514 15.366 69.033 16.859 66.931 16.859ZM79.065 14.595H88.811C88.9083 14.1358 88.9562 13.6675 88.954 13.198C88.954 9.34504 86.231 6.26204 82.41 6.26204C78.349 6.26204 75.578 9.29704 75.578 13.198C75.578 17.1 78.301 20.135 82.648 20.135C85.133 20.135 87.091 19.123 88.286 17.341L85.61 15.751C85.037 16.522 83.986 17.052 82.696 17.052C80.976 17.052 79.542 16.329 79.065 14.595ZM79.018 11.946C79.4 10.26 80.642 9.29603 82.409 9.29603C83.795 9.29603 85.229 10.067 85.61 11.946H79.018ZM113.367 6.26204C111.456 6.26204 110.118 6.98504 109.163 8.18904V6.64704H105.819V25H109.163V18.208C110.118 19.412 111.456 20.135 113.367 20.135C116.854 20.135 119.673 17.1 119.673 13.198C119.673 9.29704 116.807 6.26204 113.367 6.26204ZM112.746 16.859C110.692 16.859 109.163 15.366 109.163 13.15C109.163 10.934 110.692 9.44104 112.746 9.44104C114.8 9.44104 116.329 10.934 116.329 13.151C116.329 15.366 114.8 16.859 112.746 16.859ZM124.88 14.595H134.626C134.722 14.162 134.77 13.68 134.77 13.198C134.77 9.34504 132.047 6.26204 128.225 6.26204C124.164 6.26204 121.393 9.29704 121.393 13.198C121.393 17.1 124.116 20.135 128.464 20.135C130.948 20.135 132.906 19.123 134.101 17.341L131.425 15.751C130.852 16.522 129.801 17.052 128.511 17.052C126.744 17.052 125.31 16.329 124.88 14.595ZM125.597 5.25004C126.553 5.25004 127.317 4.48004 127.317 3.51604C127.317 2.55304 126.553 1.73404 125.597 1.73404C124.642 1.73404 123.829 2.55304 123.829 3.51604C123.829 4.48004 124.642 5.25004 125.597 5.25004ZM124.785 11.946C125.167 10.26 126.409 9.29603 128.177 9.29603C129.562 9.29603 130.996 10.067 131.378 11.946H124.785ZM130.47 5.25004C131.425 5.25004 132.19 4.48004 132.19 3.51604C132.19 2.55304 131.425 1.73404 130.47 1.73404C129.515 1.73404 128.702 2.55304 128.702 3.51604C128.75 4.48004 129.515 5.25004 130.47 5.25004ZM143.13 20.087C145.662 20.087 147.86 18.737 148.958 16.667L146.044 14.981C145.519 16.041 144.42 16.715 143.082 16.715C141.076 16.715 139.595 15.222 139.595 13.15C139.595 11.079 141.076 9.58604 143.082 9.58604C144.42 9.58604 145.519 10.26 146.044 11.32L148.911 9.63404C147.86 7.61104 145.662 6.26204 143.13 6.26204C139.213 6.26204 136.298 9.29704 136.298 13.198C136.298 17.1 139.213 20.087 143.13 20.087ZM169.836 20.087C173.658 20.087 176.667 17.052 176.667 13.15C176.667 9.24903 173.658 6.26204 169.836 6.26204C166.014 6.26204 163.004 9.29704 163.004 13.198C163.004 17.1 166.014 20.087 169.836 20.087ZM169.836 16.811C167.877 16.811 166.348 15.318 166.348 13.198C166.348 11.079 167.877 9.58604 169.836 9.58604C171.842 9.58604 173.371 11.079 173.371 13.198C173.371 15.318 171.842 16.811 169.836 16.811ZM99.751 19.75H103.621L98.653 13.102L103.43 6.64704H99.465L95.786 11.946H94.64V6.64704H91.296V19.75H94.64V14.595H96.025L99.751 19.75ZM187.13 19.75H190.999L186.079 13.102L190.856 6.64704H186.891L183.165 11.994H182.018V6.64704H178.674V19.75H182.018V14.595H183.403L187.13 19.75ZM42.136 1.68604H28.616V19.7H32.2V5.10604H38.602V19.75H42.185V1.68604H42.136Z" />
</svg>;

/**
 * One of Perekrestok's two banners at the start of a drink card (the page picks which, `pickDrinkAd`), in their style:
 * their green, a large white headline with the discount on a lime plate like their «1 час», the code on a dark green
 * chip, and their logo on a white wave at the bottom with the legal line beside it, small and quiet. The code chip is
 * the link: a tap copies the code and opens Perekrestok. «✕» hides both banners in this browser for a week.
 */
export function PerekrestokAd({ ad, code, marking }: { ad: PartnerAd; code: number; marking: string }) {
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState<{ code: string } | null>(null);
  const item = ad.codes[code];
  if (hidden || !item) return null;
  const hide = () => {
    document.cookie = `${adHiddenCookie(ad)}=1; path=/; max-age=${AD_HIDE_DAYS * 24 * 60 * 60}; samesite=lax`;
    setHidden(true);
  };
  const [before = '', after = ''] = (item.title ?? '{value}').split('{value}');
  return <div className="px-ad-slot"><aside className="px-ad" aria-label="Реклама: промокод Перекрёстка">
    <div className="px-ad-top">
      <span className="px-ad-label">Реклама</span>
      <button type="button" className="px-ad-close" onClick={hide} aria-label="Скрыть рекламу на неделю">{CLOSE}</button>
    </div>
    <p className="px-ad-title">{before}<mark>{item.value}</mark>{after}</p>
    {item.order && <p className="px-ad-order">{item.order}</p>}
    <a className="px-ad-code" href={ad.href} target="_blank" rel="sponsored noopener" data-copied={copied ? '' : undefined}
      aria-label={`${item.value} ${item.who}: скопировать промокод ${item.code} и открыть Перекрёсток`}
      onClick={() => { void copyText(item.code).then(done => { if (done) setCopied({ code: item.code }); }); }}>
      <span className="px-ad-code-text"><small>Промокод</small><code>{item.code}</code></span>{copied ? DONE : COPY}
    </a>
    <div className="px-ad-foot">
      <span className="px-ad-logo" role="img" aria-label="Перекрёсток">{PEREKRESTOK_LOGO}</span>
      <p className="px-ad-fine">{ad.terms}. {marking}</p>
    </div>
    <ActionToast trigger={copied ?? ad} message={copied ? `Промокод ${copied.code} скопирован — вставьте его в Перекрёстке` : undefined} />
  </aside></div>;
}
