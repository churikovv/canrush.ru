import '@/styles/shared.css';
import '@/styles/profile.css';
import '@/styles/gacha.css';
import { RarityEmblem } from '@/components/rarity-badge';
import { headers } from 'next/headers';
import { BrandShell } from '@/components/brand-shell';
import { CapIcon, GachaMachine } from '@/components/gacha-machine';
import { ProfileNavigation } from '@/components/profile-navigation';
import { auth } from '@/lib/auth';
import { gachaPool, getGachaState } from '@/lib/gacha';
import { CAP_SOURCES, activeBanner, PITY_EPIC, PITY_LEGENDARY, PULL_COST, RARITIES, RARITY_HINTS, RARITY_LABELS, RARITY_ODDS, TEN_PULL_COST, WELCOME_CAPS } from '@/lib/gacha-fields';
import { getProfileByUserId } from '@/lib/profile';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = seoMetadata({
  title: 'Банкомат',
  description: 'Крутите автомат CanRush и собирайте карточки настоящих энергетиков: от обычных до легендарных банок, снятых с производства.',
  path: '/gacha',
});

const percent = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const cans = (count: number) => `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'банка' : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? 'банки' : 'банок'}`;

/** «Банкомат»: автомат, открытые шансы и откуда берутся крышки. */
export default async function GachaPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const [state, pool, profile] = await Promise.all([
    session ? getGachaState(session.user.id) : null,
    gachaPool(),
    session ? getProfileByUserId(session.user.id) : null,
  ]);
  // The season's banner shows its Blender scene to guests too (the state, with the banner, is only for members).
  const banner = activeBanner();
  const counts = Object.fromEntries(RARITIES.map(rarity => [rarity, pool.filter(drink => drink.rarity === rarity).length]));
  // The odds and where caps come from: on the page out of season, inside the game window («?») while a scene runs.
  const rules = <>
    <section className="gacha-info" aria-labelledby="gacha-odds-title">
      <h2 id="gacha-odds-title">Шансы</h2>
      <p className="community-muted">Сначала выбирается редкость, потом банка внутри неё. Редкость берётся из каталога: сколько сетей продают напиток прямо сейчас. В автомате {cans(pool.length)}.</p>
      <div className="settings-list gacha-odds">
        {[...RARITIES].reverse().map(rarity => <div className="settings-row" key={rarity} data-rarity={rarity}>
          <RarityEmblem rarity={rarity} />
          <span className="settings-row-text"><strong>{RARITY_LABELS[rarity]}</strong><small>{RARITY_HINTS[rarity]} · {cans(counts[rarity] ?? 0)}</small></span>
          <span className="gacha-odds-value">{percent.format(RARITY_ODDS[rarity] / 10)}%</span>
        </div>)}
      </div>
      <p className="community-muted">Гарант: эпическая или легендарная — не реже чем раз в {PITY_EPIC} круток, легендарная — раз в {PITY_LEGENDARY}. Выпавшая редкость остаётся с карточкой навсегда, даже если банка потом появится в магазинах.</p>
    </section>
    <section className="gacha-info" aria-labelledby="gacha-caps-title">
      <h2 id="gacha-caps-title">Как получить крышки</h2>
      <p className="community-muted">Крутка — {PULL_COST} крышек, десять — {TEN_PULL_COST}. На первый заход дарим {WELCOME_CAPS}. Крышки нельзя купить: только заработать на сайте.</p>
      <div className="settings-list">
        {CAP_SOURCES.map(source => <div className="settings-row" key={source.title}>
          <span className="settings-row-icon" aria-hidden="true"><CapIcon /></span>
          <span className="settings-row-text"><strong>{source.title}</strong><small>{source.note}</small></span>
        </div>)}
      </div>
      <p className="community-muted">У крышек и карточек нет денежной ценности, их нельзя продать или обменять.</p>
    </section>
  </>;
  const scene = banner?.scene ?? null;
  return <BrandShell headerAction={<ProfileNavigation active="home" />}>
    <div className="gacha-page">
      <GachaMachine initial={state} signedIn={Boolean(session)} albumHref={profile?.username ? `/profile/${profile.username}/cards` : null}
        scene={scene} seasonTitle={banner?.title ?? null} rules={scene ? rules : null} />
      {!scene && rules}
    </div>
  </BrandShell>;
}
