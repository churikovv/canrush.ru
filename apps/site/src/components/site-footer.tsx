'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';

export function SiteFooter() {
  const footerRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  const { scrollYProgress } = useScroll({
    target: footerRef,
    offset: ['start end', 'start 0.68'],
  });
  const attachmentProgress = useSpring(scrollYProgress, {
    stiffness: 180,
    damping: 28,
    mass: 0.35,
  });
  const y = useTransform(attachmentProgress, [0, 1], [28, 0]);
  const scale = useTransform(attachmentProgress, [0, 1], [0.992, 1]);

  const enableAnimation = !reducedMotion && !isTouchDevice;

  return (
    <motion.footer
      ref={footerRef}
      className="brand-footer"
      style={enableAnimation ? { y, scale } : undefined}
    >
      <div className="footer-main">
        <div className="footer-intro">
          <div className="footer-brand" aria-label="CanRush">
            <span className="footer-mark">
              <Image src="/brand/logo-mark-white.svg" width={17} height={13} alt="" />
            </span>
            <Image src="/brand/logo-wordmark-white.svg" width={63} height={18} alt="" />
          </div>
          <p className="footer-description">Сервис по поиску энергетических напитков</p>
        </div>

        <div className="footer-navigation">
          <div className="footer-connect">
            <div className="footer-group footer-contact">
              <span className="footer-label">Связаться</span>
              <a href="mailto:hello@canrush.ru">hello@canrush.ru</a>
            </div>
            <div className="footer-group footer-socials">
              <span className="footer-label">Соцсети</span>
              <div className="footer-social-row">
                <span className="footer-social-icon" role="img" aria-label="Telegram">
                  <Image src="/brand/icons/telegram.svg" width={24} height={24} alt="" />
                </span>
                <span className="footer-social-name">Telegram</span>
              </div>
            </div>
          </div>

          <div className="footer-group footer-service">
            <span className="footer-label">Сервис</span>
            <div className="footer-service-links">
              <Link href="/tierlists">Тирлисты</Link>
              <Link href="/catalog">Каталог</Link>
              <Link href="/prices">Цены по магазинам</Link>
              <Link href="/terms">Пользовательское соглашение</Link>
              <Link href="/privacy">Политика обработки данных</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="footer-copyright">CanRush.ru © 2026</p>
        <p className="footer-legal">
          Сайт не аффилирован и не одобрен производителями или ретейлерами. Информация представлена
          в ознакомительных целях.
        </p>
      </div>
    </motion.footer>
  );
}
