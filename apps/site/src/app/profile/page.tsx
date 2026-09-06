import type { Metadata } from 'next';
import Image from 'next/image';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { SignOutButton } from '@/components/sign-out-button';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Профиль',
  robots: { index: false, follow: false },
};

function memberSince(value: Date | string): string {
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(
    new Date(value),
  );
}

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');

  return (
    <BrandShell>
      <div className="profile-layout">
        <section className="profile-hero">
          <div className="profile-banner">
            <Image
              src="/brand/profile-illustration.png"
              width={188}
              height={120}
              alt=""
              aria-hidden="true"
              priority
            />
          </div>
          <div className="profile-identity">
            <span className="profile-avatar" aria-hidden="true">
              @
            </span>
            <p className="profile-role">Участник CanRush</p>
            <h1>{session.user.email}</h1>
            <p>Аккаунт с {memberSince(session.user.createdAt)}</p>
          </div>
        </section>

        <section className="profile-section" aria-labelledby="favorites-title">
          <div className="section-heading">
            <div>
              <p className="section-label">Персональная подборка</p>
              <h2 id="favorites-title">Избранное</h2>
            </div>
            <span className="count-badge" aria-label="В избранном 0 товаров">
              0
            </span>
          </div>
          <div className="empty-state">
            <h3>Здесь появятся ваши энергетики</h3>
            <p>
              Каталог ещё готовится. Когда он откроется, отмеченные товары будут храниться в этом
              профиле.
            </p>
          </div>
        </section>

        <SignOutButton />
      </div>
    </BrandShell>
  );
}
