import '@/styles/engine.css';
import { headers } from 'next/headers';
import Link from '@/components/navigation-progress';
import { BrandShell } from '@/components/brand-shell';
import { BetaEngineBanner } from '@/components/beta-engine-banner';
import { ProfileNavigation } from '@/components/profile-navigation';
import { auth } from '@/lib/auth';
import { BETA_ENGINE_PLACES, getBetaEngine } from '@/lib/beta-engine';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = seoMetadata({
  title: 'Двигатель Canrush',
  description: `Первые ${BETA_ENGINE_PLACES} участников Canrush получают тег «Двигатель» и личный номер навсегда.`,
  path: '/engine',
});

/** What the home «Двигатель» banner opens: the full banner with the places gauge and how the number works. */
export default async function EnginePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const engine = await getBetaEngine(session?.user.id ?? null);
  return <BrandShell headerAction={<ProfileNavigation active="home" />}>
    <div className="contest-page">
      <BetaEngineBanner data={engine} signedIn={Boolean(session)} />
      <section className="contest-rules" aria-labelledby="engine-rules-title">
        <h2 id="engine-rules-title">Как это работает</h2>
        <ol>
          <li><strong>Кто получает.</strong> Первые {BETA_ENGINE_PLACES} участников, которые создали аккаунт в Canrush. Номер выдаётся автоматически при регистрации — ничего делать не нужно.</li>
          <li><strong>Номер.</strong> Чем раньше вы с нами, тем меньше номер. Он виден в вашем теге и в карточке в разделе «Люди».</li>
          <li><strong>Навсегда.</strong> Номер и тег «Двигатель» остаются с вами, даже когда все места займут. Номер удалённого аккаунта никому не переходит.</li>
          <li><strong>Тег.</strong> Его можно выбрать в <Link href="/profile/settings?section=tags">настройках профиля</Link>, чтобы он стоял рядом с вашим именем.</li>
        </ol>
      </section>
    </div>
  </BrandShell>;
}
