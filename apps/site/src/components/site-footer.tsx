'use client';

import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { TELEGRAM_BOT_URL, TELEGRAM_CHANNEL_URL } from '@/components/telegram-promo';
import { NRJ_PARTY } from '@/lib/partners';
import { useRef, useSyncExternalStore } from 'react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';

const COARSE_POINTER = '(pointer: coarse)';

function subscribeToPointer(onChange: () => void) {
  const query = window.matchMedia(COARSE_POINTER);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

export function SiteFooter() {
  const footerRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const isTouchDevice = useSyncExternalStore(
    subscribeToPointer,
    () => window.matchMedia(COARSE_POINTER).matches,
    () => false,
  );

  const { scrollYProgress } = useScroll({
    target: footerRef,
    offset: ['start end', 'start 0.68'],
  });
  const attachmentProgress = useSpring(scrollYProgress, {
    stiffness: 180,
    damping: 28,
    mass: 0.35,
  });
  const y = useTransform(attachmentProgress, [0, 1], [24, 0]);

  const enableAnimation = !reducedMotion && !isTouchDevice;

  return (
    <footer ref={footerRef} className="brand-footer">
      <motion.div className="footer-content" style={enableAnimation ? { y } : undefined}>
        <div className="footer-main">
          <div className="footer-intro">
            <div className="footer-brand" aria-label="CanRush">
              <span className="footer-mark">
                <Image src="/brand/logo-mark-white.svg" width={17} height={13} alt="" />
              </span>
              <Image src="/brand/logo-wordmark-white.svg" width={63} height={18} alt="" />
            </div>
            <p className="footer-description">Первая социальная сеть для любителей энергетических напитков</p>
            <div className="footer-partner">
              <span className="footer-partner-logo"><Image src={NRJ_PARTY.logo} width={64} height={64} alt={NRJ_PARTY.name} /></span>
              <div className="footer-partner-copy">
                <p><span className="footer-label">При поддержке сообщества</span><strong>{NRJ_PARTY.name}</strong></p>
                <div className="footer-partner-socials">
                  <a href={NRJ_PARTY.telegram.url} target="_blank" rel="noopener noreferrer" aria-label={`Telegram ${NRJ_PARTY.name} ${NRJ_PARTY.telegram.handle} (откроется в новой вкладке)`}>
                    <span className="footer-social-icon" aria-hidden="true"><Image src="/brand/icons/telegram.svg" width={24} height={24} alt="" /></span>
                    <span>Telegram</span>
                  </a>
                  <a href={NRJ_PARTY.tiktok.url} target="_blank" rel="noopener noreferrer" aria-label={`TikTok ${NRJ_PARTY.name} ${NRJ_PARTY.tiktok.handle} (откроется в новой вкладке)`}>
                    <span className="footer-social-icon" aria-hidden="true"><Image src="/brand/icons/tiktok-mark.svg" width={24} height={24} alt="" /></span>
                    <span>TikTok</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="footer-navigation">
            <div className="footer-connect">
              <div className="footer-group footer-contact">
                <span className="footer-label">Связаться</span>
                <a href="mailto:hello@canrush.ru">hello@canrush.ru</a>
              </div>
              <div className="footer-group footer-socials">
                <span className="footer-label">Соцсети</span>
                <a className="footer-social-row" href={TELEGRAM_CHANNEL_URL} target="_blank" rel="noopener noreferrer" aria-label="Telegram-канал CanRush (откроется в новой вкладке)">
                  <span className="footer-social-icon" aria-hidden="true">
                    <Image src="/brand/icons/telegram.svg" width={24} height={24} alt="" />
                  </span>
                  <span className="footer-social-name">Telegram</span>
                </a>
                <a className="footer-social-row" href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer" aria-label="Telegram-бот CanRush (откроется в новой вкладке)">
                  <span className="footer-social-icon" aria-hidden="true">
                    <Image src="/brand/icons/telegram.svg" width={24} height={24} alt="" />
                  </span>
                  <span className="footer-social-name">Telegram-бот</span>
                </a>
              </div>
            </div>

            <div className="footer-group footer-service">
              <span className="footer-label">Сервис</span>
              <nav className="footer-service-links" aria-label="Разделы CanRush">
                <Link href="/tierlists">Тирлисты энергетиков</Link>
                <Link href="/catalog">Каталог энергетиков</Link>
                <Link href="/market">Маркет</Link>
                <Link href="/prices">Цены по магазинам</Link>
                <Link href="/terms">Пользовательское соглашение</Link>
                <Link href="/privacy">Политика обработки данных</Link>
                <Link href="/account-deletion">Удаление аккаунта</Link>
              </nav>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copyright">canrush.ru © 2026</p>
          <div className="footer-legal"><p>Используя сайт, вы подтверждаете своё совершеннолетие. Если вам нет 18 лет, покиньте сайт.</p>
          <p>
            Сайт не аффилирован и не одобрен производителями или ретейлерами. Информация представлена
            в ознакомительных целях.
          </p></div>
        </div>
      </motion.div>
    </footer>
  );
}
