'use client';

import Image from 'next/image';
import Link from '@/components/navigation-progress';
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
            <p className="footer-about">Сравнивайте цены на энергетики, читайте отзывы о вкусе и дизайне, составляйте тирлисты и находите редкие банки в маркете сообщества.</p>
          </div>

          <div className="footer-navigation">
            <div className="footer-connect">
              <div className="footer-group footer-contact">
                <span className="footer-label">Связаться</span>
                <a href="mailto:hello@canrush.ru">hello@canrush.ru</a>
              </div>
              <div className="footer-group footer-socials">
                <span className="footer-label">Соцсети</span>
                <a className="footer-social-row" href="https://t.me/canrushoff" target="_blank" rel="noopener noreferrer" aria-label="Telegram-канал CanRush (откроется в новой вкладке)">
                  <span className="footer-social-icon" aria-hidden="true">
                    <Image src="/brand/icons/telegram.svg" width={24} height={24} alt="" />
                  </span>
                  <span className="footer-social-name">Telegram</span>
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
              </nav>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copyright">CanRush.ru © 2026</p>
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
