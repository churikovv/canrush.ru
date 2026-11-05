'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChatBubblesIcon } from '@/components/chat-bubbles-icon';
import { isChatId } from '@/lib/community-chat-fields';

// The panel (messages, composer, emoji, its styles) loads on the first press only: most visits never open the chat.
const ChatPanel = dynamic(() => import('@/components/community-chat-panel'), { ssr: false });

/**
 * «Чат сообщества»: the round button with two bubbles over every page with the site's navigation (it lives in
 * ProfileNavigation, so game screens and the admin panel have none). On a phone it floats above the tab bar and the
 * cookie notice and slides away while the page scrolls down. A link with `?chat=<message>` (a mention or a reply in the
 * bell, Telegram or push) opens the panel on that message.
 */
export function CommunityChat({ signedIn }: { signedIn: boolean }) {
  const params = useSearchParams();
  const requested = params?.get('chat') ?? null;
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [focus, setFocus] = useState<{ id: string } | null>(null);
  const [handled, setHandled] = useState<string | null>(null);
  const [away, setAway] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  if (requested && requested !== handled) {
    setHandled(requested);
    setMounted(true);
    setOpen(true);
    setFocus(isChatId(requested) ? { id: requested } : null);
  }
  // The link did its job: drop `?chat` so a reload or a shared address does not open the panel again.
  useEffect(() => {
    if (!requested) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('chat');
    window.history.replaceState(null, '', url);
  }, [requested]);

  // On a phone the button steps aside while the page scrolls down and comes back on the way up.
  useEffect(() => {
    let last = window.scrollY, frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY, delta = y - last;
        if (Math.abs(delta) < 8) return;
        setAway(delta > 0 && y > 160);
        last = y;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); window.cancelAnimationFrame(frame); };
  }, []);

  return <>
    <button ref={button} type="button" className="chat-fab motion-local" data-away={away || undefined} aria-haspopup="dialog" aria-expanded={open}
      aria-label="Чат сообщества" title="Чат сообщества" onClick={() => { setMounted(true); setOpen(true); setFocus(null); }}>
      <ChatBubblesIcon />
    </button>
    {mounted && <ChatPanel open={open} focus={focus} signedIn={signedIn} onClose={() => { setOpen(false); button.current?.focus({ preventScroll: true }); }} />}
  </>;
}
