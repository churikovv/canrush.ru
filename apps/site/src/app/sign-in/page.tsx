import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { SignInForm } from '@/components/sign-in-form';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Вход',
  robots: { index: false, follow: false },
};

export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect('/profile');

  return (
    <BrandShell headerAction={<ProfileNavigation />}>
      <div className="auth-layout sign-in-layout">
        <section className="auth-intro">
          <div className="auth-illustration" aria-hidden="true">
            <Image
              src="/brand/profile-illustration.png"
              width={188}
              height={120}
              alt=""
              priority
            />
          </div>
          <p className="section-label">Аккаунт CanRush</p>
          <h1>Сохраняйте энергетики, а не пароли</h1>
          <p>
            Введите email. Мы пришлём одноразовую ссылку, после входа откроется ваш профиль и
            избранное.
          </p>
        </section>
        <SignInForm />
      </div>
    </BrandShell>
  );
}
