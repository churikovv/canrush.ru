'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export function MarketInboxRefresh() {
  const router = useRouter();
  useEffect(() => { const timer = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, 15000); return () => clearInterval(timer); }, [router]);
  return null;
}
