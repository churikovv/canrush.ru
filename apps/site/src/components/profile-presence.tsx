'use client';

import { useEffect, useRef, useState } from 'react';
import { heartbeatAction, readPresenceAction } from '@/app/profile/community-actions';
import { authClient } from '@/lib/auth-client';
import { lastSeenLabel } from '@/lib/last-seen';

type Presence = 'online' | 'offline' | 'hidden';

export function ActivityHeartbeat() {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    let lastActivity = Date.now();
    let lastPing = 0;
    let pending = false;
    const ping = () => {
      const now = Date.now();
      if (pending || document.visibilityState !== 'visible' || now - lastActivity > 90_000 || now - lastPing < 30_000) return;
      pending = true;
      lastPing = now;
      void heartbeatAction(document.documentElement.hasAttribute('data-telegram-app')).catch(() => {}).finally(() => { pending = false; });
    };
    const active = () => { lastActivity = Date.now(); ping(); };
    const visible = () => { if (document.visibilityState === 'visible') active(); };
    const timer = setInterval(ping, 45_000);
    window.addEventListener('pointerdown', active);
    window.addEventListener('keydown', active);
    window.addEventListener('scroll', active, { passive: true });
    document.addEventListener('visibilitychange', visible);
    ping();
    return () => {
      clearInterval(timer);
      window.removeEventListener('pointerdown', active);
      window.removeEventListener('keydown', active);
      window.removeEventListener('scroll', active);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [userId]);
  return null;
}

export function ProfilePresence({ userId, initial, lastSeen: initialLastSeen = null }: { userId: string; initial: Presence; lastSeen?: string | null }) {
  const [status, setStatus] = useState<Presence | 'unknown'>(initial);
  const [lastSeen, setLastSeen] = useState(initialLastSeen);
  const [now, setNow] = useState(() => new Date());
  const current = useRef<Presence | 'unknown'>(initial);
  useEffect(() => {
    let cancelled = false;
    let pending = false;
    const read = async () => {
      if (document.visibilityState !== 'visible' || pending) return;
      pending = true;
      try {
        const value = await readPresenceAction(userId);
        if (cancelled) return;
        // Going offline right now: the last visit is about now, without an extra request for the timestamp.
        if (current.current === 'online' && value === 'offline') setLastSeen(new Date().toISOString());
        current.current = value;
        setStatus(value);
        setNow(new Date());
      }
      catch { if (!cancelled) setStatus('unknown'); }
      finally { pending = false; }
    };
    const timer = setInterval(() => { void read(); }, 30_000);
    document.addEventListener('visibilitychange', read);
    void read();
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener('visibilitychange', read); };
  }, [userId, initial]);
  const label = status === 'online' ? 'В сети' : status === 'offline' ? lastSeen ? `В сети ${lastSeenLabel(lastSeen, now)}` : 'Не в сети' : status === 'hidden' ? 'Статус скрыт' : 'Статус недоступен';
  return <span className={`profile-presence profile-presence--${status}`} role="status" title={status === 'offline' && lastSeen ? new Date(lastSeen).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'long', timeStyle: 'short' }) : undefined} suppressHydrationWarning><span aria-hidden="true" />{label}</span>;
}
