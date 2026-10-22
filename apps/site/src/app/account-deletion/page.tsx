import '@/styles/shared.css';
import '@/styles/legal.css';
import type { Metadata } from 'next';
import Link from '@/components/navigation-progress';
import { BrandShell } from '@/components/brand-shell';
import { LegalDocument, type LegalSection } from '@/components/legal-document';
import { LEGAL_DETAILS } from '@/lib/legal';
import { seoMetadata } from '@/lib/seo';

const { contactEmail, privacyEffectiveDate: effectiveDate, privacyEffectiveDateIso: effectiveDateIso } = LEGAL_DETAILS;

export const metadata: Metadata = seoMetadata({
  title: 'Удаление аккаунта',
  description: 'Как удалить аккаунт CanRush на сайте и в приложении и какие данные удаляются.',
  path: '/account-deletion',
});

// The public page Google Play and RuStore ask for: how to delete the account and what happens to the data.
// Keep it in line with deleteAccountAction (profile/actions.ts) and the cascade rules of the database.
const sections: LegalSection[] = [
  {
    id: 'how',
    title: 'Как удалить аккаунт',
    content: (
      <>
        <p>Удалить аккаунт можно самостоятельно — на сайте <a href="https://canrush.ru">canrush.ru</a> или в приложении CanRush для Android:</p>
        <ol>
          <li>Войдите в аккаунт.</li>
          <li>Откройте «Профиль» и нажмите «Редактировать профиль» (или перейдите по ссылке <Link href="/profile/edit">canrush.ru/profile/edit</Link>).</li>
          <li>Внизу страницы нажмите «Удалить аккаунт» и подтвердите удаление.</li>
        </ol>
        <p>Аккаунт удаляется сразу, восстановить его нельзя. Приложение после этого можно удалить с телефона обычным способом.</p>
      </>
    ),
  },
  {
    id: 'request',
    title: 'Если нет доступа к аккаунту',
    content: (
      <p>
        Напишите на <a href={`mailto:${contactEmail}?subject=${encodeURIComponent('Удаление аккаунта CanRush')}`}>{contactEmail}</a> с
        адреса, привязанного к аккаунту, или укажите ник в CanRush и Telegram, если входили через Telegram. Мы можем попросить
        подтвердить, что аккаунт принадлежит вам, и удалим его в течение 30 дней с момента подтверждения.
      </p>
    ),
  },
  {
    id: 'deleted',
    title: 'Что удаляется',
    content: (
      <>
        <p>Вместе с аккаунтом безвозвратно удаляются:</p>
        <ul>
          <li>почта, имя, ник, описание, аватар, баннер и настройки профиля;</li>
          <li>отзывы и их фотографии, комментарии, записи на стене и вложения, реакции и лайки;</li>
          <li>тирлисты, избранное, календарь выпитого, коллекция вкусов, опыт и достижения;</li>
          <li>объявления маркета, заказы и переписка по ним (у второго участника заказа переписка тоже пропадёт), магазины;</li>
          <li>подписки, жалобы, блокировки участников, уведомления и их настройки;</li>
          <li>привязка Telegram и настройки бота, сессии входа, устройства для push-уведомлений.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'kept',
    title: 'Что может сохраниться',
    content: (
      <ul>
        <li>номер участника «Двигателя беты» — без связи с человеком, чтобы номера не выдавались повторно;</li>
        <li>обезличенная статистика переходов по рекламным ссылкам и аналитика посещений — по правилам <Link href="/privacy#processing">Политики</Link>;</li>
        <li>записи журнала действий администраторов и сведения, которые нужно хранить по закону или для разрешения уже возникшего спора, — только на этот срок.</li>
      </ul>
    ),
  },
  {
    id: 'partial',
    title: 'Удалить только часть данных',
    content: (
      <p>
        Не удаляя аккаунт, можно удалить отдельные отзывы, комментарии, записи, тирлисты и объявления, очистить профиль,
        отвязать Telegram и отключить уведомления в <Link href="/profile/settings">настройках</Link>. Push-уведомления
        отключаются в настройках Android. Подробнее об обработке данных — в <Link href="/privacy">Политике обработки персональных данных</Link>.
      </p>
    ),
  },
];

export default function AccountDeletionPage() {
  return (
    <BrandShell surfaceClassName="legal-surface">
      <LegalDocument
        title="Удаление аккаунта"
        summary="Как удалить аккаунт CanRush и что происходит с данными."
        effectiveDate={effectiveDate}
        effectiveDateIso={effectiveDateIso}
        sections={sections}
      />
    </BrandShell>
  );
}
