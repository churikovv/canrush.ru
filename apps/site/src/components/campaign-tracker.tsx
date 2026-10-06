'use client';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { COOKIE_CONSENT_EVENT, hasCookieConsent } from '@/lib/cookie-consent';
export function CampaignTracker() {
  const id=useSearchParams().get('cr_campaign');
  const sentId=useRef<string | null>(null);
  useEffect(()=>{
    if (!id) return;
    const send=()=>{
      if (sentId.current === id || !hasCookieConsent()) return;
      sentId.current=id;
      void fetch(`/api/campaign-visit?id=${encodeURIComponent(id)}`,{method:'POST',credentials:'same-origin',keepalive:true}).catch(()=>{});
    };
    send(); window.addEventListener(COOKIE_CONSENT_EVENT,send);
    return ()=>window.removeEventListener(COOKIE_CONSENT_EVENT,send);
  },[id]);
  return null;
}
