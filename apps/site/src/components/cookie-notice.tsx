'use client';

import Link from '@/components/navigation-progress';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { COOKIE_CONSENT_EVENT, COOKIE_CONSENT_KEY, hasCookieConsent } from '@/lib/cookie-consent';

function setNoticeVisible(visible: boolean): void {
  if (visible) {
    document.documentElement.dataset.cookieNotice = 'visible';
    return;
  }
  delete document.documentElement.dataset.cookieNotice;
}

export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let accepted = false;
    try {
      accepted = hasCookieConsent();
    } catch {
      // The notice remains available when browser storage is blocked.
    }

    const shouldShow = !accepted;
    const animationFrame = window.requestAnimationFrame(() => {
      setVisible(shouldShow);
      setNoticeVisible(shouldShow);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      setNoticeVisible(false);
    };
  }, []);

  function acceptCookies() {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    } catch {
      // Closing still works for the current page if storage is unavailable.
    }
    setVisible(false);
    setNoticeVisible(false);
    window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
  }

  if (!visible) return null;

  return (
    <motion.aside
      className="cookie-notice"
      aria-labelledby="cookie-notice-title"
      aria-live="polite"
      initial={false}
    >
      <div className="cookie-notice-copy">
        <h2 id="cookie-notice-title">Cookie на CanRush</h2>
        <p>
          Мы используем необходимые cookie для входа и, с вашего согласия, Яндекс Метрику для
          статистики и улучшения сайта. <Link href="/privacy#cookies">Подробнее в Политике</Link>.
        </p>
      </div>
      <button className="cookie-notice-button" type="button" onClick={acceptCookies}>
        Принять и закрыть
      </button>
    </motion.aside>
  );
}
