import '@/styles/shared.css';
import '@/styles/auth.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import { BrandShell } from '@/components/brand-shell';
import Link from '@/components/navigation-progress';
import { ProfileNavigation } from '@/components/profile-navigation';
import { SignInForm } from '@/components/sign-in-form';
import { TelegramSignIn } from '@/components/telegram-sign-in';
import { auth } from '@/lib/auth';
import { getTelegramEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Вход',
  robots: { index: false, follow: false },
};

export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect('/profile');
  const telegram = getTelegramEnv() !== null;

  return (
    <BrandShell headerAction={<ProfileNavigation active="profile" />}>
      <div className="auth-layout sign-in-card">
        <div className="auth-illustration" aria-hidden="true">
          <Image src="/brand/profile-illustration.png" width={188} height={120} alt="" priority />
        </div>
        <h1>Вход в CanRush</h1>
        {telegram ? <>
          <TelegramSignIn />
          <p className="sign-in-divider"><span>или по почте</span></p>
        </> : null}
        <div className="sign-in-email"><SignInForm /></div>
        <p className="privacy-note">
          Входя, вы принимаете <Link href="/terms">Соглашение</Link> и <Link href="/privacy">Политику обработки данных</Link>.
        </p>
      </div>
    </BrandShell>
  );
}
