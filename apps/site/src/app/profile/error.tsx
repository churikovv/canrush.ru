'use client';
import { useErrorReport } from '@/lib/client-error-report';
import '@/styles/shared.css';
import '@/styles/profile.css';

export default function ProfileError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useErrorReport(error);
  return <div className="community-profile community-empty" role="alert"><h1>Не удалось загрузить профиль</h1><p>Попробуйте ещё раз.</p><button className="community-button" onClick={reset}>Повторить загрузку</button></div>;
}
