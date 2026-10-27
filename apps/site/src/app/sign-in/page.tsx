import '@/styles/shared.css';
import '@/styles/auth.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { ReviewSignIn } from '@/components/review-sign-in';
import { SignInPanel } from '@/components/sign-in-panel';
import { auth } from '@/lib/auth';
import { getReviewLoginEnv, getTelegramEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Вход',
  robots: { index: false, follow: false },
};

/** Sign-in: «Для себя» or «Бизнес» (`?for=business`, the business landing links here), email and Telegram. */
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const business = (await searchParams).for === 'business';
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect(business ? '/business/cabinet' : '/profile');
  const telegram = getTelegramEnv() !== null;
  const reviewLogin = getReviewLoginEnv() !== null;

  return (
    <BrandShell headerAction={<ProfileNavigation active="profile" />}>
      <div className="auth-layout sign-in-card">
        <SignInPanel telegram={telegram} initial={business ? 'business' : 'personal'} />
        {reviewLogin ? <ReviewSignIn /> : null}
      </div>
    </BrandShell>
  );
}
